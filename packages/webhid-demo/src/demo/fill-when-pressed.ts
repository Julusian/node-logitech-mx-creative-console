import type { MXCreativeConsoleWeb } from '@logitech-mx-creative-console/webhid'
import type { Demo } from './demo.js'

export class FillWhenPressedDemo implements Demo {
	private pressed: number[] = []

	public async start(device: MXCreativeConsoleWeb): Promise<void> {
		await device.clearPanel()
	}
	public async stop(device: MXCreativeConsoleWeb): Promise<void> {
		await device.clearPanel()
	}
	public async keyDown(device: MXCreativeConsoleWeb, keyIndex: number): Promise<void> {
		if (this.pressed.indexOf(keyIndex) === -1) {
			this.pressed.push(keyIndex)

			await device.fillKeyColor(keyIndex, 255, 0, 0)
		}
	}
	public async keyUp(device: MXCreativeConsoleWeb, keyIndex: number): Promise<void> {
		const index = this.pressed.indexOf(keyIndex)
		if (index !== -1) {
			this.pressed.splice(index, 1)

			await device.clearKey(keyIndex)
		}
	}
}
