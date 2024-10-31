import type { StreamDeckProperties } from '../../models/base.js'
import type { MXCreativeConsoleInputService } from './interface.js'
import type { MXCreativeConsoleEvents } from '../../types.js'
import type { CallbackHook } from '../callback-hook.js'
import type { StreamDeckButtonControlDefinition } from '../../controlDefinition.js'
import { uint8ArrayToDataView } from '../../util.js'

export class KeypadInputService implements MXCreativeConsoleInputService {
	protected readonly deviceProperties: Readonly<StreamDeckProperties>
	readonly #eventSource: CallbackHook<MXCreativeConsoleEvents>

	readonly #buttonControlsByEncoded = new Map<number, StreamDeckButtonControlDefinition>()
	readonly #pushedButtons = new Set<number>()

	constructor(deviceProperties: Readonly<StreamDeckProperties>, eventSource: CallbackHook<MXCreativeConsoleEvents>) {
		this.deviceProperties = deviceProperties
		this.#eventSource = eventSource

		for (const control of this.deviceProperties.CONTROLS) {
			if (control.type !== 'button') continue

			this.#buttonControlsByEncoded.set(control.hidId, control)
		}
	}

	handleInput(data: Uint8Array): void {
		if (data[2] === 0x2b) return // Ignore acks to drawing

		console.log('got', data)

		const dataView = uint8ArrayToDataView(data)

		this.#handleButtonInput(dataView)
	}

	#handleButtonInput(view: DataView): void {
		if (
			view.getUint8(0) !== 0xff ||
			view.getUint8(1) !== 0x02 ||
			view.getUint8(2) !== 0x00 ||
			view.getUint8(4) !== 0x01
		)
			return

		const pushedControls: StreamDeckButtonControlDefinition[] = []
		const pushedControlIds = new Set<number>()

		for (let i = 5; i < view.byteLength; i += 1) {
			const value = view.getUint16(i, true)
			if (value === 0) break

			const control = this.#buttonControlsByEncoded.get(value)
			if (!control) continue

			pushedControlIds.add(control.hidId)
			pushedControls.push(control)
		}

		// Check for key ups
		for (const keyId of this.#pushedButtons) {
			// Check if still pressed
			if (pushedControlIds.has(keyId)) continue

			const control = this.#buttonControlsByEncoded.get(keyId)
			if (control) this.#eventSource.emit('up', control)

			this.#pushedButtons.delete(keyId)
		}

		for (const control of pushedControls) {
			// Check if already pressed
			if (this.#pushedButtons.has(control.hidId)) continue

			this.#pushedButtons.add(control.hidId)
			this.#eventSource.emit('down', control)
		}
	}
}
