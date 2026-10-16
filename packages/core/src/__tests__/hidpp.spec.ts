import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'eventemitter3'
import type { HIDDeviceEvents } from '../hid-device.js'
import { HidppError, HidppTimeoutError, HidppTransport } from '../hidpp.js'

class FakeDevice extends EventEmitter<HIDDeviceEvents> {
	readonly sent: Uint8Array[] = []
	/** Answer each request as it is sent */
	autoAnswer: ((request: Uint8Array) => [number, number[]] | null) | null = null

	sendReports = vi.fn(async (buffers: Uint8Array[]) => {
		for (const buffer of buffers) {
			this.sent.push(buffer)
			const answer = this.autoAnswer?.(buffer)
			if (answer) this.emit('input', answer[0], new Uint8Array(answer[1]))
		}
	})

	answer(reportId: number, data: number[]) {
		this.emit('input', reportId, new Uint8Array(data))
	}
}

function makeRequest(featureIndex: number, functionSwId: number, ...params: number[]): Uint8Array {
	const request = new Uint8Array(20)
	request.set([0x11, 0xff, featureIndex, functionSwId, ...params])
	return request
}

/** Answer a request by echoing its header, as the device does */
function echo(request: Uint8Array, ...params: number[]): [number, number[]] {
	return [request[0], [request[1], request[2], request[3], ...params]]
}

describe('HidppTransport', () => {
	let device: FakeDevice
	let transport: HidppTransport

	beforeEach(() => {
		device = new FakeDevice()

		transport = new HidppTransport(device as any)
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('resolves with the answer', async () => {
		device.autoAnswer = (request) => echo(request, 0x42)

		const answer = await transport.request(makeRequest(0x0f, 0x2b, 0x00, 50))

		expect(Array.from(answer.subarray(0, 4))).toEqual([0xff, 0x0f, 0x2b, 0x42])
		expect(device.sent).toHaveLength(1)
	})

	test('accepts an answer in a different report id', async () => {
		// Image writes are sent in report 0x14, but answered in 0x13
		device.autoAnswer = (request) => [0x13, [request[1], request[2], request[3], 0xc1]]

		const answer = await transport.request(makeRequest(0x02, 0x2b))

		expect(answer[3]).toBe(0xc1)
	})

	test('rejects with the code of an error answer', async () => {
		device.autoAnswer = (request) => [0x11, [0xff, 0xff, request[2], request[3], 0x07]]

		const result = transport.request(makeRequest(0x02, 0xfb))

		await expect(result).rejects.toBeInstanceOf(HidppError)
		await expect(result).rejects.toMatchObject({ code: 0x07 })
	})

	test('forwards reports which are not answers', async () => {
		const onInput = vi.fn()
		transport.on('input', onInput)

		// A button notification, while nothing is pending
		device.answer(0x13, [0xff, 0x02, 0x00, 0x00, 0x01, 0x05])
		expect(onInput).toHaveBeenCalledTimes(1)

		// A notification from the same feature as the pending request, but without its software id
		device.autoAnswer = (request) => {
			device.answer(0x13, [0xff, 0x02, 0x00, 0x00, 0x01, 0x05])
			return echo(request)
		}
		await transport.request(makeRequest(0x02, 0x2b))

		expect(onInput).toHaveBeenCalledTimes(2)
		expect(onInput).toHaveBeenLastCalledWith(0x13, expect.any(Uint8Array))
	})

	test('does not forward answers', async () => {
		const onInput = vi.fn()
		transport.on('input', onInput)
		device.autoAnswer = (request) => echo(request)

		await transport.request(makeRequest(0x02, 0x2b))

		expect(onInput).not.toHaveBeenCalled()
	})

	test('sends one request at a time', async () => {
		const first = transport.request(makeRequest(0x0f, 0x2b))
		const second = transport.request(makeRequest(0x0b, 0x3b))

		await vi.waitFor(() => expect(device.sent).toHaveLength(1))
		// Give the second a chance to be sent, if it were going to be
		await new Promise((resolve) => setTimeout(resolve, 10))
		expect(device.sent).toHaveLength(1)

		device.answer(0x11, [0xff, 0x0f, 0x2b])
		await first

		await vi.waitFor(() => expect(device.sent).toHaveLength(2))
		expect(device.sent[1][2]).toBe(0x0b)

		device.answer(0x11, [0xff, 0x0b, 0x3b])
		await second
	})

	test('times out, retrying as asked', async () => {
		vi.useFakeTimers()

		const result = transport
			.request(makeRequest(0x0b, 0x3b), { timeout: 100, attempts: 3 })
			.catch((e: unknown) => e)

		await vi.advanceTimersByTimeAsync(300)
		expect(await result).toBeInstanceOf(HidppTimeoutError)
		expect(device.sent).toHaveLength(3)
	})

	test('a retry can be answered', async () => {
		vi.useFakeTimers()

		const result = transport.request(makeRequest(0x0b, 0x3b), { timeout: 100, attempts: 3 })

		await vi.advanceTimersByTimeAsync(150)
		expect(device.sent).toHaveLength(2)
		device.answer(0x11, [0xff, 0x0b, 0x3b])

		await expect(result).resolves.toBeInstanceOf(Uint8Array)
		expect(device.sent).toHaveLength(2)
	})

	test('continues after a failed request', async () => {
		device.autoAnswer = (request) =>
			request[2] === 0x01 ? [0x11, [0xff, 0xff, request[2], request[3], 0x05]] : echo(request)

		const failed = transport.request(makeRequest(0x01, 0x2b))
		const succeeded = transport.request(makeRequest(0x02, 0x2b))

		await expect(failed).rejects.toBeInstanceOf(HidppError)
		await expect(succeeded).resolves.toBeInstanceOf(Uint8Array)
	})

	test('a sequence stops at the first failure', async () => {
		device.autoAnswer = (request) =>
			request[4] === 2 ? [0x11, [0xff, 0xff, request[2], request[3], 0x05]] : echo(request)

		const result = transport.requestSequence([
			makeRequest(0x02, 0x2b, 1),
			makeRequest(0x02, 0x2b, 2),
			makeRequest(0x02, 0x2b, 3),
		])

		await expect(result).rejects.toBeInstanceOf(HidppError)
		expect(device.sent.map((r) => r[4])).toEqual([1, 2])
	})

	test('nothing else is sent during an exclusive run', async () => {
		device.autoAnswer = (request) => echo(request)

		const order: string[] = []
		const exclusive = transport.runExclusive(async (send) => {
			await send(makeRequest(0x02, 0x2b, 1))
			order.push('exclusive 1')
			await new Promise((resolve) => setTimeout(resolve, 10))
			await send(makeRequest(0x02, 0x2b, 2))
			order.push('exclusive 2')
		})
		const other = transport.request(makeRequest(0x0f, 0x2b)).then(() => order.push('other'))

		await Promise.all([exclusive, other])
		expect(order).toEqual(['exclusive 1', 'exclusive 2', 'other'])
	})
})
