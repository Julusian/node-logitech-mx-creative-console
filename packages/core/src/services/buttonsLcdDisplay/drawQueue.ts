import type { HidppTransport } from '../../hidpp.js'
import type { Coordinate, Dimension } from '../../id.js'
import type { ButtonLcdImagePacker } from '../imagePacker/interface.js'
import type { ImageWriteStatus, MXConsoleImageWriter } from '../imageWriter/types.js'

export type Region = Coordinate & Dimension

/** How long to wait before redrawing what the device was too busy to accept */
const BUSY_RETRY_DELAY = 1
/** How long the device can stay too busy to accept anything, before giving up on what is waiting to be drawn */
const BUSY_TIMEOUT = 1000

/** Identifies the gaps between the keys, alongside the key indexes */
const GAPS = -1

interface Waiter {
	/** The version of each key (or the gaps) which must be drawn */
	versions: ReadonlyMap<number, number>
	resolve: () => void
	reject: (error: Error) => void
}

interface DrawImage {
	/** Where on the device to draw it */
	region: Region
	/** The rgba pixels of the region */
	pixels: Uint8Array
	/** The keys (and the gaps) whose content this image shows, with the version it shows */
	covers: ReadonlyMap<number, number>
	/** The keys (and the gaps) this image was drawn for, to draw again if it is not accepted */
	dirty: readonly number[]
	/** Whether this image clears the whole panel */
	isClear: boolean
}

type DrawResult = ImageWriteStatus | 'too-large'

/**
 * Draws the keys of the lcd, from a copy of what should be shown on it.
 *
 * The device draws images slower than they can be sent, and rejects any it has no room for. So rather than queueing
 * every update as an image, updates are made to the copy, and whenever the device is ready, everything which has
 * changed since is drawn as a single image covering all of it. A key updated again before it was drawn is only drawn
 * once, with its latest content.
 */
export class LcdDrawQueue {
	readonly #imageWriter: MXConsoleImageWriter
	readonly #imagePacker: ButtonLcdImagePacker
	readonly #transport: Pick<HidppTransport, 'runExclusive'>
	/** The region of the lcd covered by the keys, including the gaps between them */
	readonly #bounds: Region
	/** The whole lcd, which is cleared as one */
	readonly #panelSize: Dimension
	/** The region of each key, by index */
	readonly #keys: ReadonlyMap<number, Region>

	/** What should be shown on the lcd, within the bounds, as rgba */
	readonly #canvas: Uint8Array
	/** The keys whose content is known, so can be included in an image drawn for other keys */
	readonly #known = new Set<number>()
	/** The keys (and the gaps) whose content has changed since it was drawn */
	readonly #dirty = new Set<number>()
	/** Each update to a key (or the gaps) increments its version */
	readonly #versions = new Map<number, number>()
	/** The latest version of each key (or the gaps) the device has accepted */
	readonly #drawnVersions = new Map<number, number>()
	#waiters: Waiter[] = []
	/** The versions to mark as drawn once a pending clear of the panel is drawn */
	#pendingClear: ReadonlyMap<number, number> | null = null
	/** Draw each key as its own image next, as the last combined image was too large to send */
	#splitNext = false
	#draining = false
	/** The last image the device was too busy for, to resend without encoding again if nothing has changed since */
	#lastRejected: { image: DrawImage; packets: Uint8Array[] } | null = null

	constructor(
		imageWriter: MXConsoleImageWriter,
		imagePacker: ButtonLcdImagePacker,
		transport: Pick<HidppTransport, 'runExclusive'>,
		keys: ReadonlyMap<number, Region>,
		panelSize: Dimension,
	) {
		this.#imageWriter = imageWriter
		this.#imagePacker = imagePacker
		this.#transport = transport
		this.#keys = keys
		this.#panelSize = panelSize
		this.#bounds = boundingRegion([...keys.values()])
		this.#canvas = new Uint8Array(this.#bounds.width * this.#bounds.height * 4)
	}

	/** The region of the lcd covered by the keys, including the gaps between them */
	get bounds(): Readonly<Region> {
		return this.#bounds
	}

	/**
	 * Update some keys, resolving once they have been drawn
	 * @param updates The new rgba pixels of each key
	 */
	public async updateKeys(updates: ReadonlyArray<{ index: number; pixels: Uint8Array }>): Promise<void> {
		for (const { index, pixels } of updates) {
			const region = this.#keys.get(index)
			if (!region) throw new TypeError(`Unknown key ${index}`)

			this.#writeToCanvas(region, pixels)
			this.#known.add(index)
			this.#dirty.add(index)
		}

		return this.#waitForDrawn(updates.map((update) => update.index))
	}

	/**
	 * Update the whole region covered by the keys, including the gaps between them, resolving once it has been drawn
	 * @param pixels The new rgba pixels of the region
	 */
	public async updateAll(pixels: Uint8Array): Promise<void> {
		this.#writeToCanvas(this.#bounds, pixels)

		const ids = [...this.#keys.keys(), GAPS]
		for (const id of ids) {
			if (id !== GAPS) this.#known.add(id)
			this.#dirty.add(id)
		}

		return this.#waitForDrawn(ids)
	}

	/** Clear the whole lcd, resolving once it has been cleared */
	public async clear(): Promise<void> {
		this.#canvas.fill(0)

		const ids = [...this.#keys.keys(), GAPS]
		for (const id of ids) {
			if (id !== GAPS) this.#known.add(id)
		}
		// Anything waiting to be drawn has been replaced by the clear
		this.#dirty.clear()

		const drawn = this.#waitForDrawn(ids)
		this.#pendingClear = this.#currentVersions(ids)
		return drawn
	}

	#writeToCanvas(region: Region, pixels: Uint8Array): void {
		const rowLength = region.width * 4
		if (pixels.length !== rowLength * region.height) {
			throw new RangeError(`Expected ${rowLength * region.height} bytes of pixels, got ${pixels.length}`)
		}

		const canvasStride = this.#bounds.width * 4
		const offsetX = (region.x - this.#bounds.x) * 4
		for (let y = 0; y < region.height; y++) {
			this.#canvas.set(
				pixels.subarray(y * rowLength, (y + 1) * rowLength),
				(region.y - this.#bounds.y + y) * canvasStride + offsetX,
			)
		}
	}

	#readFromCanvas(region: Region): Uint8Array {
		const rowLength = region.width * 4
		const pixels = new Uint8Array(rowLength * region.height)

		const canvasStride = this.#bounds.width * 4
		const offsetX = (region.x - this.#bounds.x) * 4
		for (let y = 0; y < region.height; y++) {
			const start = (region.y - this.#bounds.y + y) * canvasStride + offsetX
			pixels.set(this.#canvas.subarray(start, start + rowLength), y * rowLength)
		}

		return pixels
	}

	/** Bump the versions of some keys (or the gaps), and wait for those versions to be drawn */
	async #waitForDrawn(ids: number[]): Promise<void> {
		for (const id of ids) {
			this.#versions.set(id, (this.#versions.get(id) ?? 0) + 1)
		}

		const waiter = Promise.withResolvers<void>()
		this.#waiters.push({ versions: this.#currentVersions(ids), resolve: waiter.resolve, reject: waiter.reject })

		this.#scheduleDrain()

		return waiter.promise
	}

	#currentVersions(ids: Iterable<number>): Map<number, number> {
		const versions = new Map<number, number>()
		for (const id of ids) versions.set(id, this.#versions.get(id) ?? 0)
		return versions
	}

	#hasWork(): boolean {
		return this.#pendingClear !== null || this.#dirty.size > 0
	}

	#scheduleDrain(): void {
		if (this.#draining) return
		this.#draining = true

		// Wait a moment before drawing, to give the application a chance to make any other updates it has
		setTimeout(() => {
			this.#drain()
				.catch((e) => this.#failAll(e instanceof Error ? e : new Error(String(e))))
				.finally(() => {
					this.#draining = false
					if (this.#hasWork()) this.#scheduleDrain()
				})
		}, 0)
	}

	async #drain(): Promise<void> {
		/** When the device started rejecting images for being too busy */
		let busySince: number | null = null

		while (this.#hasWork()) {
			const images = this.#compose()

			for (let i = 0; i < images.length; i++) {
				const image = images[i]

				let result: DrawResult
				try {
					result = await this.#draw(image)
				} catch (e) {
					this.#fail(image, e instanceof Error ? e : new Error(String(e)))
					continue
				}

				if (result === 'accepted') {
					busySince = null
					for (const [id, version] of image.covers) {
						if (version > (this.#drawnVersions.get(id) ?? 0)) this.#drawnVersions.set(id, version)
					}
					this.#resolveWaiters()
				} else if (result === 'too-large') {
					if (image.dirty.length <= 1 || image.isClear) {
						this.#fail(image, new Error('Failed to encode image small enough for the device'))
						continue
					}

					// Draw the keys individually instead, giving up on the gaps between them
					for (const id of image.dirty) {
						if (id === GAPS) {
							this.#drawnVersions.set(GAPS, image.covers.get(GAPS) ?? 0)
						} else {
							this.#dirty.add(id)
						}
					}
					this.#resolveWaiters()
					this.#splitNext = true
					this.#requeue(images.slice(i + 1))
					break
				} else {
					// The device had no room for it, so draw it again once there is, along with anything changed since
					this.#requeue(images.slice(i))

					busySince ??= Date.now()
					if (Date.now() - busySince >= BUSY_TIMEOUT) {
						this.#failAll(new Error('Device was too busy to accept the image'))
						return
					}

					await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_DELAY))
					break
				}
			}
		}
	}

	/** Decide what images to draw, for everything which has changed */
	#compose(): DrawImage[] {
		if (this.#pendingClear) {
			const covers = this.#pendingClear
			this.#pendingClear = null

			const region = { x: 0, y: 0, ...this.#panelSize }
			const pixels = new Uint8Array(region.width * region.height * 4)
			return [{ region, pixels, covers, dirty: [], isClear: true }]
		}

		const dirty = [...this.#dirty]
		this.#dirty.clear()

		const splitNext = this.#splitNext
		this.#splitNext = false

		const dirtyKeys = dirty.filter((id) => id !== GAPS)
		const region = dirty.includes(GAPS)
			? this.#bounds
			: boundingRegion(dirtyKeys.map((index) => this.#getKeyRegion(index)))

		// Every key in the region gets drawn, so the content of every one must be known
		const coveredKeys = [...this.#keys].filter(([, keyRegion]) => intersects(region, keyRegion)).map(([i]) => i)
		const canCombine = coveredKeys.every((index) => this.#known.has(index))

		if (!splitNext && canCombine && dirty.length > 1) {
			const coveredIds = region === this.#bounds ? [...coveredKeys, GAPS] : coveredKeys
			return [
				{
					region,
					pixels: this.#readFromCanvas(region),
					covers: this.#currentVersions(coveredIds),
					dirty,
					isClear: false,
				},
			]
		}

		// Without the content of the keys between them, the keys can only be drawn individually
		if (dirty.includes(GAPS)) this.#drawnVersions.set(GAPS, this.#versions.get(GAPS) ?? 0)
		this.#resolveWaiters()

		return dirtyKeys.map((index) => {
			const keyRegion = this.#getKeyRegion(index)
			return {
				region: keyRegion,
				pixels: this.#readFromCanvas(keyRegion),
				covers: this.#currentVersions([index]),
				dirty: [index],
				isClear: false,
			}
		})
	}

	#getKeyRegion(index: number): Region {
		const region = this.#keys.get(index)
		if (!region) throw new Error(`Unknown key ${index}`)
		return region
	}

	/** Put some images which were not drawn back to be drawn again */
	#requeue(images: DrawImage[]): void {
		for (const image of images) {
			if (image.isClear) {
				// A clear made since replaces this one
				this.#pendingClear ??= image.covers
			} else {
				for (const id of image.dirty) this.#dirty.add(id)
			}
		}
	}

	async #draw(image: DrawImage): Promise<DrawResult> {
		const lastRejected = this.#lastRejected
		this.#lastRejected = null

		let packets: Uint8Array[]
		if (lastRejected && isSameImage(lastRejected.image, image)) {
			packets = lastRejected.packets
		} else {
			const byteBuffer = await this.#imagePacker.convertPixelBuffer(
				image.pixels,
				{ format: 'rgba', offset: 0, stride: image.region.width * 4 },
				image.region,
				this.#imageWriter.maxImageByteLength,
			)
			if (!byteBuffer) return 'too-large'

			packets = this.#imageWriter.generateFillImageWrites(
				{ pixelSize: image.region, pixelPosition: image.region },
				byteBuffer,
			)
		}

		// The device only reports whether it had room for the image in its answer to the last packet
		const result = await this.#transport.runExclusive(async (send) => {
			for (const packet of packets) {
				const status = this.#imageWriter.parseWriteAnswer(await send(packet))
				if (status !== 'accepted') return status
			}
			return 'accepted' as const
		})

		if (result === 'busy') this.#lastRejected = { image, packets }
		return result
	}

	#resolveWaiters(): void {
		this.#waiters = this.#waiters.filter((waiter) => {
			for (const [id, version] of waiter.versions) {
				if ((this.#drawnVersions.get(id) ?? 0) < version) return true
			}
			waiter.resolve()
			return false
		})
	}

	/** Reject anything waiting for an image which could not be drawn */
	#fail(image: DrawImage, error: Error): void {
		this.#waiters = this.#waiters.filter((waiter) => {
			for (const [id, version] of waiter.versions) {
				const failedVersion = image.covers.get(id)
				if (failedVersion !== undefined && failedVersion >= version) {
					waiter.reject(error)
					return false
				}
			}
			return true
		})
	}

	/** Give up on everything waiting to be drawn */
	#failAll(error: Error): void {
		this.#dirty.clear()
		this.#pendingClear = null

		const waiters = this.#waiters
		this.#waiters = []
		for (const waiter of waiters) waiter.reject(error)
	}
}

function boundingRegion(regions: Region[]): Region {
	const x = Math.min(...regions.map((region) => region.x))
	const y = Math.min(...regions.map((region) => region.y))
	const maxX = Math.max(...regions.map((region) => region.x + region.width))
	const maxY = Math.max(...regions.map((region) => region.y + region.height))

	return { x, y, width: maxX - x, height: maxY - y }
}

/** Whether two images show the same versions of the same region */
function isSameImage(a: DrawImage, b: DrawImage): boolean {
	if (a.isClear !== b.isClear) return false
	if (a.region.x !== b.region.x || a.region.y !== b.region.y) return false
	if (a.region.width !== b.region.width || a.region.height !== b.region.height) return false

	if (a.covers.size !== b.covers.size) return false
	for (const [id, version] of a.covers) {
		if (b.covers.get(id) !== version) return false
	}
	return true
}

function intersects(a: Region, b: Region): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}
