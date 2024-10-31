import type { StreamDeckProperties } from '../../models/base.js'
import type { MXCreativeConsoleEvents } from '../../types.js'
import type { CallbackHook } from '../callback-hook.js'
import type { StreamDeckEncoderControlDefinition } from '../../controlDefinition.js'
import { ButtonOnlyInputService } from './gen1.js'

export class Gen2InputService extends ButtonOnlyInputService {
	readonly #eventSource: CallbackHook<MXCreativeConsoleEvents>
	readonly #encoderControls: Readonly<StreamDeckEncoderControlDefinition[]>
	readonly #encoderState: boolean[]

	constructor(deviceProperties: Readonly<StreamDeckProperties>, eventSource: CallbackHook<MXCreativeConsoleEvents>) {
		super(deviceProperties, eventSource)

		this.#eventSource = eventSource
		this.#encoderControls = deviceProperties.CONTROLS.filter(
			(control): control is StreamDeckEncoderControlDefinition => control.type === 'encoder',
		)
		const maxIndex = Math.max(-1, ...this.#encoderControls.map((control) => control.index))
		this.#encoderState = new Array<boolean>(maxIndex + 1).fill(false)
	}

	handleInput(data: Uint8Array): void {
		const inputType = data[0]
		switch (inputType) {
			case 0x00: // Button
				super.handleInput(data)
				break
			case 0x03: // Encoder
				this.#handleEncoderInput(data)
				break
		}
	}

	#handleEncoderInput(data: Uint8Array): void {
		switch (data[3]) {
			case 0x00: // press/release
				for (const encoderControl of this.#encoderControls) {
					const keyPressed = Boolean(data[4 + encoderControl.hidIndex])
					const stateChanged = keyPressed !== this.#encoderState[encoderControl.index]
					if (stateChanged) {
						this.#encoderState[encoderControl.index] = keyPressed
						if (keyPressed) {
							this.#eventSource.emit('down', encoderControl)
						} else {
							this.#eventSource.emit('up', encoderControl)
						}
					}
				}
				break
			case 0x01: // rotate
				for (const encoderControl of this.#encoderControls) {
					const intArray = new Int8Array(data.buffer, data.byteOffset, data.byteLength)
					const value = intArray[4 + encoderControl.hidIndex]
					if (value !== 0) {
						this.#eventSource.emit('rotate', encoderControl, value)
					}
				}
				break
		}
	}
}
