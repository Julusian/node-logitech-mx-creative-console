import { describe, test, expect } from 'vitest'
import { MXConsoleDefaultImageWriter } from '../services/imageWriter/imageWriter.js'

describe('MXConsoleDefaultImageWriter', () => {
	const writer = new MXConsoleDefaultImageWriter()
	const props = { pixelSize: { width: 118, height: 118 }, pixelPosition: { x: 23, y: 6 } }

	test('single packet image', () => {
		const packets = writer.generateFillImageWrites(props, new Uint8Array(100).fill(0xaa))

		expect(packets).toHaveLength(1)
		expect(Array.from(packets[0].subarray(0, 20))).toEqual([
			0x14, 0xff, 0x02, 0x2b, 0xe1, 0x01, 0x00, 0x01, 0x00, 0x00, 23, 0x00, 6, 0x00, 118, 0x00, 118, 0x00, 0x00,
			100,
		])
		expect(packets[0][20]).toBe(0xaa)
		expect(packets[0][120]).toBe(0)
	})

	test('multi packet image', () => {
		const packets = writer.generateFillImageWrites(props, new Uint8Array(10000))

		expect(packets.map((p) => p[4])).toEqual([0xa1, 0x22, 0x63])
		expect(packets.every((p) => p.length === 4095)).toBe(true)
	})

	test('rejects an image too long to describe', () => {
		expect(() => writer.generateFillImageWrites(props, new Uint8Array(0x10000))).toThrow(RangeError)
		expect(() => writer.generateFillImageWrites(props, new Uint8Array(0xffff))).not.toThrow()
	})

	test('parses answers', () => {
		expect(writer.parseWriteAnswer(new Uint8Array([0xff, 0x02, 0x2b, 0xc1, 0x00, 0x01]))).toBe('accepted')
		expect(writer.parseWriteAnswer(new Uint8Array([0xff, 0x02, 0x2b, 0xc2, 0x00, 0x00]))).toBe('accepted')
		expect(writer.parseWriteAnswer(new Uint8Array([0xff, 0x02, 0x2b, 0xc1, 0xfb, 0x00]))).toBe('busy')
		expect(() => writer.parseWriteAnswer(new Uint8Array([0xff, 0x02, 0x2b, 0xc1, 0x05, 0x00]))).toThrow()
	})
})
