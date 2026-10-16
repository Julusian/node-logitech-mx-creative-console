import { describe, test, expect, vi } from 'vitest'
import { JpegButtonLcdImagePacker } from '../services/imagePacker/jpeg.js'
import type { EncodeJPEGHelper } from '../models/base.js'

const SOURCE_OPTIONS = { format: 'rgb', offset: 0, stride: 2 * 3 } as const
const SIZE = { width: 2, height: 2 }

/** An encoder whose output gets smaller as the quality drops */
function makeEncoder(lengthForQuality: (quality: number | undefined) => number) {
	return vi.fn<EncodeJPEGHelper>(
		async (_buffer, _width, _height, options) => new Uint8Array(lengthForQuality(options?.quality)),
	)
}

describe('JpegButtonLcdImagePacker', () => {
	test('uses the default quality when it fits', async () => {
		const encode = makeEncoder(() => 100)
		const packer = new JpegButtonLcdImagePacker(encode)

		const result = await packer.convertPixelBuffer(new Uint8Array(12), SOURCE_OPTIONS, SIZE, 100)

		expect(result).toHaveLength(100)
		expect(encode).toHaveBeenCalledTimes(1)
		expect(encode.mock.calls[0][3]).toBeUndefined()
	})

	test('reduces the quality until it fits', async () => {
		const encode = makeEncoder((quality) => quality ?? 1000)
		const packer = new JpegButtonLcdImagePacker(encode)

		const result = await packer.convertPixelBuffer(new Uint8Array(12), SOURCE_OPTIONS, SIZE, 60)

		expect(result).toHaveLength(50)
		expect(encode.mock.calls.map((call) => call[3]?.quality)).toEqual([undefined, 80, 65, 50])
	})

	test('gives up when it never fits', async () => {
		const encode = makeEncoder(() => 1000)
		const packer = new JpegButtonLcdImagePacker(encode)

		const result = await packer.convertPixelBuffer(new Uint8Array(12), SOURCE_OPTIONS, SIZE, 60)

		expect(result).toBeNull()
		expect(encode.mock.calls.at(-1)?.[3]?.quality).toBe(20)
	})

	test('encodes rgba', async () => {
		const encode = makeEncoder(() => 1)
		const packer = new JpegButtonLcdImagePacker(encode)

		await packer.convertPixelBuffer(
			new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
			SOURCE_OPTIONS,
			SIZE,
			60,
		)

		expect(Array.from(encode.mock.calls[0][0])).toEqual([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255])
		expect(encode.mock.calls[0].slice(1, 3)).toEqual([2, 2])
	})
})
