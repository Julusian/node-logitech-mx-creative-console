import { EventEmitter } from 'eventemitter3'
import type { HIDDevice } from './hid-device.js'

/** The feature index an error answer carries, followed by the feature index and function it is for */
const HIDPP_ERROR_FEATURE_INDEX = 0xff

/** HID++ long reports, which every request is sent as */
const HIDPP_LONG_REPORT_ID = 0x11
const HIDPP_LONG_REPORT_LENGTH = 20
/** Requests are addressed to the whole device, rather than a paired one */
const HIDPP_DEVICE_INDEX = 0xff
/** Tags each request, and is echoed in its answer, so a notification (which carries none) is told apart */
const HIDPP_SOFTWARE_ID = 0x0b

/** The function of the reprogrammable controls feature which sets how a control is reported */
const REPROG_CONTROLS_SET_REPORTING_FUNCTION_ID = 3
/** Report the control to the software instead of it acting as a normal HID button */
const REPROG_CONTROLS_DIVERT = 0x03

const DEFAULT_TIMEOUT = 500
const DEFAULT_ATTEMPTS = 1

export interface HidppRequestOptions {
	/** How long to wait for the device to answer, in milliseconds */
	timeout?: number
	/** How many times to send the request before giving up on an answer */
	attempts?: number
}

export interface HidppTransportEvents {
	/** Input reports which are not answers to a request, such as notifications */
	input: [reportId: number, payload: Uint8Array]
}

/** A HID++ request: report id, device index, feature index, (function << 4) | software id, then parameters */
export function createHidppRequest(featureIndex: number, functionId: number, params: number[]): Uint8Array {
	const request = new Uint8Array(HIDPP_LONG_REPORT_LENGTH)
	request.set([
		HIDPP_LONG_REPORT_ID,
		HIDPP_DEVICE_INDEX,
		featureIndex,
		(functionId << 4) | HIDPP_SOFTWARE_ID,
		...params,
	])
	return request
}

/**
 * A request to the reprogrammable controls feature, diverting a control to be reported to the software.
 * Until diverted, the control is not reported to the software at all.
 */
export function createDivertControlRequest(featureIndex: number, controlId: number): Uint8Array {
	return createHidppRequest(featureIndex, REPROG_CONTROLS_SET_REPORTING_FUNCTION_ID, [
		controlId >> 8,
		controlId & 0xff,
		REPROG_CONTROLS_DIVERT,
	])
}

/** The device answered a request with an error */
export class HidppError extends Error {
	constructor(
		/** The HID++ error code */
		public readonly code: number,
		request: Uint8Array,
	) {
		super(`HID++ request ${formatRequest(request)} failed with error 0x${code.toString(16).padStart(2, '0')}`)
		this.name = 'HidppError'
	}
}

/** The device never answered a request */
export class HidppTimeoutError extends Error {
	constructor(request: Uint8Array) {
		super(`HID++ request ${formatRequest(request)} was not answered`)
		this.name = 'HidppTimeoutError'
	}
}

function formatRequest(request: Uint8Array): string {
	return Array.from(request.subarray(0, 5), (b) => b.toString(16).padStart(2, '0')).join(' ')
}

/** Send a single request and wait for its answer, for use inside `HidppTransport.runExclusive` */
export type HidppSendRequest = (request: Uint8Array, options?: HidppRequestOptions) => Promise<Uint8Array>

interface PendingRequest {
	request: Uint8Array
	resolve: (answer: Uint8Array) => void
	reject: (error: Error) => void
}

/**
 * Sends HID++ requests to a device one at a time, waiting for each to be answered before sending the next.
 * A device handles one request at a time and silently drops any arriving while it is busy, so the only way to know
 * a write took effect is its answer.
 *
 * A request is a report of: report id, device index, feature index, (function << 4) | software id, then parameters.
 * Its answer echoes the device index, feature index and function/software id, though not always in the same report
 * id as the request, while an error answer carries them after the error marker.
 */
export class HidppTransport extends EventEmitter<HidppTransportEvents> {
	readonly #device: HIDDevice

	/** Each request waits for the one before to be answered */
	#queue: Promise<void> = Promise.resolve()
	#pending: PendingRequest | null = null

	constructor(device: HIDDevice) {
		super()

		this.#device = device
		this.#device.on('input', (reportId, data) => {
			if (!this.#handleAnswer(data)) this.emit('input', reportId, data)
		})
	}

	/**
	 * Send a request, resolving with the answer, without the report id
	 */
	public async request(request: Uint8Array, options?: HidppRequestOptions): Promise<Uint8Array> {
		const answers = await this.requestSequence([request], options)
		return answers[0]
	}

	/**
	 * Send some requests in turn, without any other requests being sent between them.
	 * Stops at the first which fails.
	 */
	public async requestSequence(requests: Uint8Array[], options?: HidppRequestOptions): Promise<Uint8Array[]> {
		return this.runExclusive(async (send) => {
			const answers: Uint8Array[] = []
			for (const request of requests) {
				answers.push(await send(request, options))
			}
			return answers
		})
	}

	/**
	 * Run a series of requests, deciding on each based on the answers to those before, without any other
	 * requests being sent until it completes.
	 */
	public async runExclusive<T>(fn: (send: HidppSendRequest) => Promise<T>): Promise<T> {
		const result = this.#queue.then(async () =>
			fn(async (request, options) => this.#sendAndAwaitAnswer(request, options)),
		)

		// Keep the queue going regardless of the outcome
		this.#queue = result.then(
			() => undefined,
			() => undefined,
		)

		return result
	}

	async #sendAndAwaitAnswer(request: Uint8Array, options: HidppRequestOptions | undefined): Promise<Uint8Array> {
		const timeout = options?.timeout ?? DEFAULT_TIMEOUT
		const attempts = options?.attempts ?? DEFAULT_ATTEMPTS

		for (let attempt = 0; attempt < attempts; attempt++) {
			const answer = Promise.withResolvers<Uint8Array | null>()
			this.#pending = { request, resolve: answer.resolve, reject: answer.reject }
			const timer = setTimeout(() => answer.resolve(null), timeout)

			try {
				await this.#device.sendReports([request])

				const data = await answer.promise
				if (data) return data
			} finally {
				this.#pending = null
				clearTimeout(timer)
			}
		}

		throw new HidppTimeoutError(request)
	}

	/** Check if an input report answers the pending request, returning true if it was consumed */
	#handleAnswer(data: Uint8Array): boolean {
		const pending = this.#pending
		if (!pending) return false

		const { request } = pending
		if (data[0] !== request[1]) return false

		if (data[1] === request[2] && data[2] === request[3]) {
			pending.resolve(data)
			return true
		}

		if (data[1] === HIDPP_ERROR_FEATURE_INDEX && data[2] === request[2] && data[3] === request[3]) {
			pending.reject(new HidppError(data[4], request))
			return true
		}

		return false
	}
}
