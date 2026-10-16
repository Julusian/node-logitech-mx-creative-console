import type {
	MXConsoleButtonControlDefinition,
	MXConsoleButtonControlDefinitionLcdFeedback,
} from '../../controlDefinition.js'
import type { HidppTransport } from '../../hidpp.js'
import type { Coordinate, Dimension, KeyIndex } from '../../id.js'
import type { MXConsolePanelProperties } from '../../models/base.js'
import type { FillPanelDimensionsOptions, FillImageOptions, FillPanelOptions } from '../../types.js'
import type { ImageWriteStatus, MXConsoleImageWriter } from '../imageWriter/types.js'
import type { ButtonsLcdDisplayService, GridSpan } from './interface.js'
import type { ButtonLcdImagePacker, InternalFillImageOptions } from '../imagePacker/interface.js'

/** How long to wait before resending an image the device was too busy to accept */
const IMAGE_BUSY_RETRY_DELAY = 5
/** How long to keep resending an image the device is too busy to accept */
const IMAGE_BUSY_TIMEOUT = 1000

export class DefaultButtonsLcdService implements ButtonsLcdDisplayService {
	readonly #imageWriter: MXConsoleImageWriter
	readonly #imagePacker: ButtonLcdImagePacker
	readonly #transport: Pick<HidppTransport, 'runExclusive'>
	readonly #deviceProperties: Readonly<MXConsolePanelProperties>

	constructor(
		imageWriter: MXConsoleImageWriter,
		imagePacker: ButtonLcdImagePacker,
		transport: Pick<HidppTransport, 'runExclusive'>,
		deviceProperties: Readonly<MXConsolePanelProperties>,
	) {
		this.#imageWriter = imageWriter
		this.#imagePacker = imagePacker
		this.#transport = transport
		this.#deviceProperties = deviceProperties
	}

	private getLcdButtonControls(): MXConsoleButtonControlDefinitionLcdFeedback[] {
		return this.#deviceProperties.CONTROLS.filter(
			(control): control is MXConsoleButtonControlDefinitionLcdFeedback =>
				control.type === 'button' && control.feedbackType === 'lcd',
		)
	}

	private calculateLcdGridSpan(buttonsLcd: MXConsoleButtonControlDefinition[]): GridSpan | null {
		if (buttonsLcd.length === 0) return null

		const allRowValues = buttonsLcd.map((button) => button.row)
		const allColumnValues = buttonsLcd.map((button) => button.column)

		return {
			minRow: Math.min(...allRowValues),
			maxRow: Math.max(...allRowValues),
			minCol: Math.min(...allColumnValues),
			maxCol: Math.max(...allColumnValues),
		}
	}

	private calculateDimensionsFromGridSpan(gridSpan: GridSpan, buttonPixelSize: Dimension): Dimension {
		const rowCount = gridSpan.maxRow - gridSpan.minRow + 1
		const columnCount = gridSpan.maxCol - gridSpan.minCol + 1

		// TODO: Consider that different rows/columns could have different dimensions

		return { width: columnCount * buttonPixelSize.width, height: rowCount * buttonPixelSize.height }
	}

	/**
	 * The region of the lcd covered by the buttons, including the gaps between them
	 */
	private calculatePaddedBounds(buttonsLcd: MXConsoleButtonControlDefinitionLcdFeedback[]): Coordinate & Dimension {
		const x = Math.min(...buttonsLcd.map((button) => button.pixelPosition.x))
		const y = Math.min(...buttonsLcd.map((button) => button.pixelPosition.y))
		const maxX = Math.max(...buttonsLcd.map((button) => button.pixelPosition.x + button.pixelSize.width))
		const maxY = Math.max(...buttonsLcd.map((button) => button.pixelPosition.y + button.pixelSize.height))

		return { x, y, width: maxX - x, height: maxY - y }
	}

	public calculateFillPanelDimensions(options: FillPanelDimensionsOptions | undefined): Dimension | null {
		const buttonLcdControls = this.getLcdButtonControls()
		const gridSpan = this.calculateLcdGridSpan(buttonLcdControls)

		if (!gridSpan || buttonLcdControls.length === 0) return null

		if (options?.withPadding) {
			const bounds = this.calculatePaddedBounds(buttonLcdControls)
			return { width: bounds.width, height: bounds.height }
		}

		return this.calculateDimensionsFromGridSpan(gridSpan, buttonLcdControls[0].pixelSize)
	}

	public async clearPanel(): Promise<void> {
		const ps: Promise<void>[] = []

		const blackBuffer = new Uint8Array(
			this.#deviceProperties.PANEL_SIZE.width * this.#deviceProperties.PANEL_SIZE.height * 4,
		)

		// TODO - cache this?
		const byteBuffer = await this.#imagePacker.convertPixelBuffer(
			blackBuffer,
			{ format: 'rgba', offset: 0, stride: this.#deviceProperties.PANEL_SIZE.width * 4 },
			this.#deviceProperties.PANEL_SIZE,
			this.#imageWriter.maxImageByteLength,
		)
		if (!byteBuffer) throw new Error('Failed to encode image small enough for the device')

		const packets = this.#imageWriter.generateFillImageWrites(
			{ pixelSize: this.#deviceProperties.PANEL_SIZE, pixelPosition: { x: 0, y: 0 } },
			byteBuffer,
		)
		ps.push(this.#sendImage(packets))

		/*
			for (const control of this.#deviceProperties.CONTROLS) {
				if (control.type !== 'button') continue

				switch (control.feedbackType) {
					case 'lcd': {
						// Handled by PANEL_SIZE


						break
					}
					case 'none':
						// Do nothing
						break
				}
			}
			*/

		await Promise.all(ps)
	}

	public async clearKey(keyIndex: KeyIndex): Promise<void> {
		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType === 'none') throw new TypeError(`Expected a valid keyIndex`)

		const pixels = new Uint8Array(control.pixelSize.width * control.pixelSize.height * 3)
		await this.fillImageRangeControl(control, pixels, {
			format: 'rgb',
			offset: 0,
			stride: control.pixelSize.width * 3,
		})
	}

	public async fillKeyColor(keyIndex: KeyIndex, r: number, g: number, b: number): Promise<void> {
		this.checkRGBValue(r)
		this.checkRGBValue(g)
		this.checkRGBValue(b)

		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType === 'none') throw new TypeError(`Expected a valid keyIndex`)

		// rgba is excessive here, but it makes the fill easier as it can be done in a 32bit uint
		const pixelCount = control.pixelSize.width * control.pixelSize.height
		const pixels = new Uint8Array(pixelCount * 4)
		const view = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength)

		// write first pixel
		view.setUint8(0, r)
		view.setUint8(1, g)
		view.setUint8(2, b)
		view.setUint8(3, 255)

		// read computed pixel
		const sample = view.getUint32(0)
		// fill with computed pixel
		for (let i = 1; i < pixelCount; i++) {
			view.setUint32(i * 4, sample)
		}

		await this.fillImageRangeControl(control, pixels, {
			format: 'rgba',
			offset: 0,
			stride: control.pixelSize.width * 4,
		})
	}

	public async fillKeyBuffer(keyIndex: KeyIndex, imageBuffer: Uint8Array, options?: FillImageOptions): Promise<void> {
		const sourceFormat = options?.format ?? 'rgb'
		this.checkSourceFormat(sourceFormat)

		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType === 'none') throw new TypeError(`Expected a valid keyIndex`)

		const imageSize = control.pixelSize.width * control.pixelSize.height * sourceFormat.length
		if (imageBuffer.length !== imageSize) {
			throw new RangeError(`Expected image buffer of length ${imageSize}, got length ${imageBuffer.length}`)
		}

		await this.fillImageRangeControl(control, imageBuffer, {
			format: sourceFormat,
			offset: 0,
			stride: control.pixelSize.width * sourceFormat.length,
		})
	}

	public async fillPanelBuffer(imageBuffer: Uint8Array, options?: FillPanelOptions): Promise<void> {
		const sourceFormat = options?.format ?? 'rgb'
		this.checkSourceFormat(sourceFormat)

		const buttonLcdControls = this.getLcdButtonControls()
		const panelGridSpan = this.calculateLcdGridSpan(buttonLcdControls)

		if (!panelGridSpan || buttonLcdControls.length === 0) {
			throw new Error(`Panel does not support being filled`)
		}

		const panelDimensions = options?.withPadding
			? this.calculatePaddedBounds(buttonLcdControls)
			: this.calculateDimensionsFromGridSpan(panelGridSpan, buttonLcdControls[0].pixelSize)

		const expectedByteCount = sourceFormat.length * panelDimensions.width * panelDimensions.height
		if (imageBuffer.length !== expectedByteCount) {
			throw new RangeError(
				`Expected image buffer of length ${expectedByteCount}, got length ${imageBuffer.length}`,
			)
		}

		// The whole panel is drawn as a single image, as drawing each button in turn visibly ripples across the panel
		const bounds = this.calculatePaddedBounds(buttonLcdControls)
		const paddedStride = bounds.width * sourceFormat.length
		const paddedBuffer = options?.withPadding
			? imageBuffer
			: this.padPanelBuffer(imageBuffer, sourceFormat.length, panelGridSpan, buttonLcdControls, bounds)

		const byteBuffer = await this.#imagePacker.convertPixelBuffer(
			paddedBuffer,
			{ format: sourceFormat, offset: 0, stride: paddedStride },
			bounds,
			this.#imageWriter.maxImageByteLength,
		)

		if (byteBuffer) {
			const packets = this.#imageWriter.generateFillImageWrites(
				{ pixelSize: bounds, pixelPosition: bounds },
				byteBuffer,
			)
			await this.#sendImage(packets)
		} else {
			// The image is too detailed to fit in a single write, so fall back to drawing each button individually
			await Promise.all(
				buttonLcdControls.map(async (control) =>
					this.fillImageRangeControl(control, paddedBuffer, {
						format: sourceFormat,
						offset:
							(control.pixelPosition.y - bounds.y) * paddedStride +
							(control.pixelPosition.x - bounds.x) * sourceFormat.length,
						stride: paddedStride,
					}),
				),
			)
		}
	}

	/**
	 * Insert the gaps between the buttons into an image which excludes them, leaving the gaps black
	 */
	private padPanelBuffer(
		imageBuffer: Uint8Array,
		bytesPerPixel: number,
		gridSpan: GridSpan,
		buttonsLcd: MXConsoleButtonControlDefinitionLcdFeedback[],
		bounds: Coordinate & Dimension,
	): Uint8Array {
		const panelDimensions = this.calculateDimensionsFromGridSpan(gridSpan, buttonsLcd[0].pixelSize)
		const sourceStride = panelDimensions.width * bytesPerPixel
		const paddedStride = bounds.width * bytesPerPixel

		const paddedBuffer = new Uint8Array(paddedStride * bounds.height)

		for (const control of buttonsLcd) {
			// TODO: Consider that different rows/columns could have different dimensions
			const sourceX = (control.column - gridSpan.minCol) * control.pixelSize.width
			const sourceY = (control.row - gridSpan.minRow) * control.pixelSize.height
			const targetX = control.pixelPosition.x - bounds.x
			const targetY = control.pixelPosition.y - bounds.y
			const rowByteCount = control.pixelSize.width * bytesPerPixel

			for (let y = 0; y < control.pixelSize.height; y++) {
				const sourceOffset = (sourceY + y) * sourceStride + sourceX * bytesPerPixel
				paddedBuffer.set(
					imageBuffer.subarray(sourceOffset, sourceOffset + rowByteCount),
					(targetY + y) * paddedStride + targetX * bytesPerPixel,
				)
			}
		}

		return paddedBuffer
	}

	private async fillImageRangeControl(
		buttonControl: MXConsoleButtonControlDefinitionLcdFeedback,
		imageBuffer: Uint8Array,
		sourceOptions: InternalFillImageOptions,
	) {
		if (buttonControl.feedbackType !== 'lcd')
			throw new TypeError(`keyIndex ${buttonControl.index} does not support lcd feedback`)

		const byteBuffer = await this.#imagePacker.convertPixelBuffer(
			imageBuffer,
			sourceOptions,
			buttonControl.pixelSize,
			this.#imageWriter.maxImageByteLength,
		)
		if (!byteBuffer) throw new Error('Failed to encode image small enough for the device')

		const packets = this.#imageWriter.generateFillImageWrites(
			{ pixelSize: buttonControl.pixelSize, pixelPosition: buttonControl.pixelPosition },
			byteBuffer,
		)
		await this.#sendImage(packets)
	}

	/**
	 * Send the packets of an image, resending it until the device has room for it.
	 * Nothing else is sent until it is accepted, so that a newer image cannot be drawn before it.
	 */
	async #sendImage(packets: Uint8Array[]): Promise<void> {
		await this.#transport.runExclusive(async (send) => {
			const deadline = Date.now() + IMAGE_BUSY_TIMEOUT
			for (;;) {
				let status: ImageWriteStatus = 'accepted'
				for (const packet of packets) {
					status = this.#imageWriter.parseWriteAnswer(await send(packet))
					if (status !== 'accepted') break
				}
				if (status === 'accepted') return

				if (Date.now() >= deadline) throw new Error('Device was too busy to accept the image')
				await new Promise((resolve) => setTimeout(resolve, IMAGE_BUSY_RETRY_DELAY))
			}
		})
	}

	private checkRGBValue(value: number): void {
		if (value < 0 || value > 255) {
			throw new TypeError('Expected a valid color RGB value 0 - 255')
		}
	}

	private checkSourceFormat(format: 'rgb' | 'rgba' | 'bgr' | 'bgra'): void {
		switch (format) {
			case 'rgb':
			case 'rgba':
			case 'bgr':
			case 'bgra':
				break
			default: {
				const fmt: never = format
				throw new TypeError(`Expected a known color format not "${fmt as string}"`)
			}
		}
	}
}
