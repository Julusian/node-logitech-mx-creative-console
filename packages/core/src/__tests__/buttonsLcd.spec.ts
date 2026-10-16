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
	MODEL: DeviceModelId.MX_CREATIVE_KEYPAD,
	PRODUCT_NAME: 'Test',
	CONTROLS: freezeDefinitions([
		...generateButtonsGrid(3, 3, { width: 118, height: 118 }, { x: 23, y: 6 }, { x: 40, y: 40 }),
		{ type: 'button', row: 3, column: 0, index: 9, hidId: 0x01a1, feedbackType: 'none' },
	]),
	PANEL_SIZE: { width: 480, height: 480 },
}

const ACCEPTED = [0xff, 0x02, 0x2b, 0xc1, 0x00, 0x01]
const BUSY = [0xff, 0x02, 0x2b, 0xc1, 0xfb, 0x00]

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
	return { service, packer, send }
}

/** The position and size an image write was drawn at */
function writeRegion(packet: Uint8Array) {
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
		const { service, packer, send } = setup()

		await service.fillPanelBuffer(makePanelBuffer(), { format: 'rgb' })

		expect(packer.convertPixelBuffer).toHaveBeenCalledTimes(1)
		const [buffer, sourceOptions, size] = packer.convertPixelBuffer.mock.calls[0]
		expect(size).toMatchObject({ width: 434, height: 434 })
		expect(sourceOptions).toEqual({ format: 'rgb', offset: 0, stride: 434 * 3 })

		const red = (x: number, y: number) => buffer[(y * 434 + x) * 3]
		for (const control of properties.CONTROLS) {
			if (control.type !== 'button' || control.feedbackType !== 'lcd') continue
			const x = control.pixelPosition.x - 23
			const y = control.pixelPosition.y - 6
			expect(red(x, y)).toBe(control.index + 1)
			expect(red(x + 117, y + 117)).toBe(control.index + 1)
		}
		// The gaps between the keys
		expect(red(118, 0)).toBe(0)
		expect(red(157, 0)).toBe(0)
		expect(red(0, 118)).toBe(0)
		expect(red(200, 140)).toBe(0)

		expect(send).toHaveBeenCalledTimes(1)
		expect(writeRegion(send.mock.calls[0][0])).toEqual({ x: 23, y: 6, width: 434, height: 434 })
	})

	test('fills the panel with an image including the gaps', async () => {
		const { service, packer, send } = setup()

		const image = new Uint8Array(434 * 434 * 4)
		await service.fillPanelBuffer(image, { format: 'rgba', withPadding: true })

		expect(packer.convertPixelBuffer).toHaveBeenCalledTimes(1)
		expect(packer.convertPixelBuffer.mock.calls[0][0]).toBe(image)
		expect(packer.convertPixelBuffer.mock.calls[0][1]).toEqual({ format: 'rgba', offset: 0, stride: 434 * 4 })
		expect(send).toHaveBeenCalledTimes(1)
		expect(writeRegion(send.mock.calls[0][0])).toEqual({ x: 23, y: 6, width: 434, height: 434 })
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
		const { service, packer, send } = setup({ packedLength: (width) => (width === 434 ? null : 10) })

		await service.fillPanelBuffer(makePanelBuffer(), { format: 'rgb' })

		// The whole panel, then each key
		expect(packer.convertPixelBuffer).toHaveBeenCalledTimes(10)
		expect(send).toHaveBeenCalledTimes(9)

		for (const [buffer, sourceOptions, size] of packer.convertPixelBuffer.mock.calls.slice(1)) {
			expect(size).toEqual({ width: 118, height: 118 })
			expect(sourceOptions.stride).toBe(434 * 3)
			// Reading the first pixel of the key finds its fill
			const key = buffer[sourceOptions.offset] - 1
			const control = properties.CONTROLS.find((c) => c.type === 'button' && c.index === key)
			expect(control).toBeDefined()
			if (control?.type !== 'button' || control.feedbackType !== 'lcd') throw new Error('not lcd')
			expect(sourceOptions.offset).toBe(
				(control.pixelPosition.y - 6) * 434 * 3 + (control.pixelPosition.x - 23) * 3,
			)
		}

		const regions = send.mock.calls.map((call) => writeRegion(call[0]))
		expect(regions).toContainEqual({ x: 23, y: 6, width: 118, height: 118 })
		expect(regions).toContainEqual({ x: 339, y: 322, width: 118, height: 118 })
	})

	test('throws when a key image cannot be made small enough', async () => {
		const { service } = setup({ packedLength: () => null })

		await expect(service.fillKeyColor(0, 255, 0, 0)).rejects.toThrow()
	})

	test('resends the whole image while the device is busy', async () => {
		// Each image is 2 packets, and the device is busy for the first attempt
		const answers = [ACCEPTED, BUSY, ACCEPTED, ACCEPTED]
		const { service, send } = setup({ packedLength: () => 5000, answer: () => answers.shift() ?? ACCEPTED })

		await service.fillKeyColor(4, 255, 0, 0)

		expect(send).toHaveBeenCalledTimes(4)
		const parts = send.mock.calls.map((call) => call[0][4])
		expect(parts).toEqual([0xa1, 0x62, 0xa1, 0x62])
	})

	test('stops resending once the device has been busy too long', async () => {
		vi.useFakeTimers()
		const { service, send } = setup({ answer: () => BUSY })

		const result = service.fillKeyColor(4, 255, 0, 0).catch((e: unknown) => e)

		await vi.advanceTimersByTimeAsync(1100)
		expect(await result).toEqual(new Error('Device was too busy to accept the image'))
		expect(send.mock.calls.length).toBeGreaterThan(10)
	})
})
