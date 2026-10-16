import { describe, test, expect, vi, afterEach } from 'vitest'
import { DefaultButtonsLcdService } from '../services/buttonsLcdDisplay/default.js'
import { MXConsoleDefaultImageWriter } from '../services/imageWriter/imageWriter.js'
import type { ButtonLcdImagePacker } from '../services/imagePacker/interface.js'
import type { HidppSendRequest, HidppTransport } from '../hidpp.js'
import { freezeDefinitions, generateButtonsGrid } from '../controlsGenerator.js'
import type { MXConsolePanelProperties } from '../models/base.js'
import { DeviceModelId } from '../id.js'

// The layout of the keypad
const properties: MXConsolePanelProperties = {
	model: DeviceModelId.MX_CREATIVE_KEYPAD,
	productName: 'Test',
	controls: freezeDefinitions([
		...generateButtonsGrid(3, 3, { width: 118, height: 118 }, { x: 23, y: 6 }, { x: 40, y: 40 }),
		{
			id: 'page-l',
			type: 'button',
			row: 3,
			column: 0,
			index: 9,
			hidIndex: 0x01a1,
			feedbackType: 'none',
			bounds: { x: 23, y: 520, width: 118, height: 40 },
		},
	]),
	faceSize: { width: 480, height: 560 },
	panelSize: { width: 480, height: 480 },
	supportsBrightness: true,
}

const ACCEPTED = [0xff, 0x02, 0x2b, 0xc1, 0x00, 0x01]
const BUSY = [0xff, 0x02, 0x2b, 0xc1, 0xfb, 0x00]

interface Region {
	x: number
	y: number
	width: number
	height: number
}

function setup(options?: { packedLength?: (width: number) => number | null; answer?: () => number[] }) {
	const packer = {
		convertPixelBuffer: vi.fn<ButtonLcdImagePacker['convertPixelBuffer']>(async (_buffer, _options, size) => {
			const length = options?.packedLength ? options.packedLength(size.width) : 10
			return length === null ? null : new Uint8Array(length)
		}),
	}
	const send = vi.fn<HidppSendRequest>(async () => new Uint8Array(options?.answer?.() ?? ACCEPTED))
	const transport: Pick<HidppTransport, 'runExclusive'> = { runExclusive: async (fn) => fn(send) }

	const service = new DefaultButtonsLcdService(new MXConsoleDefaultImageWriter(), packer, transport, properties)

	/** The regions of each image sent, from the first packet of each */
	const drawnRegions = (): Region[] =>
		send.mock.calls
			.map((call) => call[0])
			.filter((packet) => packet[4] & 0x80)
			.map(writeRegion)

	/** Read a pixel of an image given to the packer, as rgba */
	const encodedPixel = (call: number, x: number, y: number) => {
		const [pixels, sourceOptions] = packer.convertPixelBuffer.mock.calls[call]
		const offset = sourceOptions.offset + y * sourceOptions.stride + x * 4
		return Array.from(pixels.subarray(offset, offset + 4))
	}

	return { service, packer, send, drawnRegions, encodedPixel }
}

/** The position and size an image write was drawn at */
function writeRegion(packet: Uint8Array): Region {
	const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
	return { x: view.getUint16(9), y: view.getUint16(11), width: view.getUint16(13), height: view.getUint16(15) }
}

/** A panel image without padding, where each key is filled with its index + 1 */
function makePanelBuffer(): Uint8Array {
	const buffer = new Uint8Array(354 * 354 * 3)
	for (let y = 0; y < 354; y++) {
		for (let x = 0; x < 354; x++) {
			const key = Math.floor(y / 118) * 3 + Math.floor(x / 118)
			buffer.set([key + 1, 0, 0], (y * 354 + x) * 3)
		}
	}
	return buffer
}

const WHOLE_PANEL = { x: 23, y: 6, width: 434, height: 434 }
const WHOLE_LCD = { x: 0, y: 0, width: 480, height: 480 }
const keyRegion = (index: number): Region => ({
	x: 23 + (index % 3) * 158,
	y: 6 + Math.floor(index / 3) * 158,
	width: 118,
	height: 118,
})

describe('DefaultButtonsLcdService', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	test('panel dimensions', () => {
		const { service } = setup()

		expect(service.calculateFillPanelDimensions(undefined)).toEqual({ width: 354, height: 354 })
		expect(service.calculateFillPanelDimensions({ withPadding: true })).toEqual({ width: 434, height: 434 })
	})

	test('fills the panel with a single image, with the gaps between the keys added', async () => {
		const { service, packer, drawnRegions, encodedPixel } = setup()

		await service.fillPanelBuffer(makePanelBuffer(), { format: 'rgb' })

		expect(drawnRegions()).toEqual([WHOLE_PANEL])
		expect(packer.convertPixelBuffer).toHaveBeenCalledTimes(1)
		expect(packer.convertPixelBuffer.mock.calls[0][1]).toMatchObject({ format: 'rgba', stride: 434 * 4 })

		for (let index = 0; index < 9; index++) {
			const region = keyRegion(index)
			const x = region.x - 23
			const y = region.y - 6
			expect(encodedPixel(0, x, y)).toEqual([index + 1, 0, 0, 255])
			expect(encodedPixel(0, x + 117, y + 117)).toEqual([index + 1, 0, 0, 255])
		}
		// The gaps between the keys
		expect(encodedPixel(0, 118, 0)[0]).toBe(0)
		expect(encodedPixel(0, 157, 0)[0]).toBe(0)
		expect(encodedPixel(0, 0, 118)[0]).toBe(0)
		expect(encodedPixel(0, 200, 140)[0]).toBe(0)
	})

	test('fills the panel with an image including the gaps', async () => {
		const { service, drawnRegions, encodedPixel } = setup()

		const image = new Uint8Array(434 * 434 * 3)
		image.set([7, 8, 9], (140 * 434 + 200) * 3)
		await service.fillPanelBuffer(image, { format: 'rgb', withPadding: true })

		expect(drawnRegions()).toEqual([WHOLE_PANEL])
		expect(encodedPixel(0, 200, 140)).toEqual([7, 8, 9, 255])
	})

	test('rejects a panel image of the wrong size', async () => {
		const { service } = setup()

		await expect(
			service.fillPanelBuffer(new Uint8Array(354 * 354 * 3), { format: 'rgb', withPadding: true }),
		).rejects.toThrow(RangeError)
		await expect(service.fillPanelBuffer(new Uint8Array(434 * 434 * 3), { format: 'rgb' })).rejects.toThrow(
			RangeError,
		)
	})

	test('falls back to filling each key when the panel image is too large', async () => {
		const { service, drawnRegions } = setup({ packedLength: (width) => (width === 434 ? null : 10) })

		await service.fillPanelBuffer(makePanelBuffer(), { format: 'rgb' })

		const regions = drawnRegions()
		expect(regions).toHaveLength(9)
		for (let index = 0; index < 9; index++) expect(regions).toContainEqual(keyRegion(index))
	})

	test('draws keys individually while the content of the keys between them is unknown', async () => {
		const { service, drawnRegions } = setup()

		await Promise.all([service.fillKeyColor(0, 255, 0, 0), service.fillKeyColor(2, 0, 255, 0)])

		expect(drawnRegions()).toEqual([keyRegion(0), keyRegion(2)])
	})

	test('combines keys updated together once their content is known', async () => {
		const { service, send, drawnRegions, encodedPixel } = setup()

		await service.clearPanel()
		send.mockClear()

		await Promise.all([service.fillKeyColor(0, 255, 0, 0), service.fillKeyColor(1, 0, 255, 0)])

		expect(drawnRegions()).toEqual([{ x: 23, y: 6, width: 276, height: 118 }])
		expect(encodedPixel(1, 0, 0)).toEqual([255, 0, 0, 255])
		expect(encodedPixel(1, 158, 0)).toEqual([0, 255, 0, 255])
	})

	test('only draws the latest content of a key updated again before it was drawn', async () => {
		const { service, drawnRegions, encodedPixel } = setup()

		await Promise.all([
			service.fillKeyColor(4, 255, 0, 0),
			service.fillKeyColor(4, 0, 255, 0),
			service.fillKeyColor(4, 0, 0, 255),
		])

		expect(drawnRegions()).toEqual([keyRegion(4)])
		expect(encodedPixel(0, 0, 0)).toEqual([0, 0, 255, 255])
	})

	test('clears the whole lcd', async () => {
		const { service, drawnRegions, encodedPixel } = setup()

		await service.clearPanel()

		expect(drawnRegions()).toEqual([WHOLE_LCD])
		expect(encodedPixel(0, 240, 240)[0]).toBe(0)
	})

	test('draws a key filled after a clear, after the clear', async () => {
		const { service, drawnRegions } = setup()

		await service.fillKeyColor(4, 255, 0, 0)
		await Promise.all([service.clearPanel(), service.fillKeyColor(4, 0, 255, 0)])

		expect(drawnRegions()).toEqual([keyRegion(4), WHOLE_LCD, keyRegion(4)])
	})

	test('throws when a key image cannot be made small enough', async () => {
		const { service } = setup({ packedLength: () => null })

		await expect(service.fillKeyColor(0, 255, 0, 0)).rejects.toThrow()
	})

	test('resends the whole image while the device is busy, without encoding it again', async () => {
		// Each image is 2 packets, and the device is busy for the first attempt
		const answers = [ACCEPTED, BUSY, ACCEPTED, ACCEPTED]
		const { service, send, packer } = setup({ packedLength: () => 5000, answer: () => answers.shift() ?? ACCEPTED })

		await service.fillKeyColor(4, 255, 0, 0)

		expect(send.mock.calls.map((call) => call[0][4])).toEqual([0xa1, 0x62, 0xa1, 0x62])
		expect(packer.convertPixelBuffer).toHaveBeenCalledTimes(1)
	})

	test('includes updates made while the device was busy in the next image', async () => {
		let deviceBusy = false
		const { service, send, drawnRegions, encodedPixel } = setup({ answer: () => (deviceBusy ? BUSY : ACCEPTED) })

		await service.clearPanel()
		send.mockClear()

		// The device stays busy until the second key is updated
		deviceBusy = true
		const firstFill = service.fillKeyColor(0, 255, 0, 0)
		await vi.waitFor(() => expect(send).toHaveBeenCalled())
		const secondFill = service.fillKeyColor(1, 0, 255, 0)
		deviceBusy = false

		await Promise.all([firstFill, secondFill])

		const regions = drawnRegions()
		expect(regions[0]).toEqual(keyRegion(0))
		expect(regions.at(-1)).toEqual({ x: 23, y: 6, width: 276, height: 118 })
		expect(encodedPixel(2, 158, 0)).toEqual([0, 255, 0, 255])
	})

	test('gives up once the device has been busy too long', async () => {
		vi.useFakeTimers()
		const { service, send } = setup({ answer: () => BUSY })

		const result = service.fillKeyColor(4, 255, 0, 0).catch((e: unknown) => e)

		await vi.advanceTimersByTimeAsync(1100)
		expect(await result).toEqual(new Error('Device was too busy to accept the image'))
		expect(send.mock.calls.length).toBeGreaterThan(10)
	})
})
