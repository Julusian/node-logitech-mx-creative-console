import type { MXConsoleProperties } from '../../models/base.js'
import type { MXCreativeConsoleInputService } from './interface.js'
import type { MXCreativeConsoleEvents } from '../../types.js'
import type { CallbackHook } from '../callback-hook.js'
import type { MXConsoleButtonControlDefinition, MXConsoleEncoderControlDefinition } from '../../controlDefinition.js'
import { uint8ArrayToDataView } from '../../util.js'

/**
 * The HID++ feature indexes of the dialpad, as listed by its own feature table.
 * These are a property of the firmware, and are what its notifications are tagged with.
 */
export const DIALPAD_REPROG_CONTROLS_FEATURE_INDEX = 0x0a
export const DIALPAD_DIAL_FEATURE_INDEX = 0x0d

/** HID++ reports carrying the notifications the dialpad sends */
const HIDPP_LONG_REPORT_ID = 0x11
/** Notifications are addressed to the whole device, rather than a paired one */
const HIDPP_DEVICE_INDEX = 0xff
/** A response carries the software id it was requested with, a notification carries none */
const HIDPP_NOTIFICATION = 0x00

export class DialpadInputService implements MXCreativeConsoleInputService {
	readonly #eventSource: CallbackHook<MXCreativeConsoleEvents>

	readonly #buttonControlsByCid = new Map<number, MXConsoleButtonControlDefinition>()
	readonly #encoderControlsByHidIndex = new Map<number, MXConsoleEncoderControlDefinition>()
	readonly #invertedDialHidIndexes: ReadonlySet<number>
	readonly #pushedButtons = new Set<number>()

	constructor(
		deviceProperties: Readonly<MXConsoleProperties>,
		eventSource: CallbackHook<MXCreativeConsoleEvents>,
		invertedDialHidIndexes: ReadonlySet<number> = new Set(),
	) {
		this.#eventSource = eventSource
		this.#invertedDialHidIndexes = invertedDialHidIndexes

		for (const control of deviceProperties.CONTROLS) {
			if (control.type === 'button') {
				this.#buttonControlsByCid.set(control.hidId, control)
			} else {
				this.#encoderControlsByHidIndex.set(control.hidIndex, control)
			}
		}
	}

	handleInput(reportId: number, data: Uint8Array): void {
		if (reportId !== HIDPP_LONG_REPORT_ID) return

		const view = uint8ArrayToDataView(data)
		if (view.getUint8(0) !== HIDPP_DEVICE_INDEX || view.getUint8(2) !== HIDPP_NOTIFICATION) return

		switch (view.getUint8(1)) {
			case DIALPAD_REPROG_CONTROLS_FEATURE_INDEX:
				this.#handleButtonInput(view)
				break
			case DIALPAD_DIAL_FEATURE_INDEX:
				this.#handleDialInput(view)
				break
		}
	}

	#handleButtonInput(view: DataView): void {
		// Every currently pressed control is listed, as 16 bit ids, ending at a zero
		const pushedCids = new Set<number>()
		for (let offset = 3; offset + 1 < view.byteLength; offset += 2) {
			const cid = view.getUint16(offset, false)
			if (cid === 0) break

			if (this.#buttonControlsByCid.has(cid)) pushedCids.add(cid)
		}

		for (const cid of this.#pushedButtons) {
			if (pushedCids.has(cid)) continue

			this.#pushedButtons.delete(cid)

			const control = this.#buttonControlsByCid.get(cid)
			if (control) this.#eventSource.emit('up', control)
		}

		for (const cid of pushedCids) {
			if (this.#pushedButtons.has(cid)) continue

			this.#pushedButtons.add(cid)

			const control = this.#buttonControlsByCid.get(cid)
			if (control) this.#eventSource.emit('down', control)
		}
	}

	#handleDialInput(view: DataView): void {
		const hidIndex = view.getUint8(3)
		const control = this.#encoderControlsByHidIndex.get(hidIndex)
		if (!control) return

		// How far it was turned since the last notification, negative when turned anticlockwise
		const reported = view.getInt8(4)
		const amount = this.#invertedDialHidIndexes.has(hidIndex) ? -reported : reported

		if (amount !== 0) this.#eventSource.emit('rotate', control, amount)
	}
}
