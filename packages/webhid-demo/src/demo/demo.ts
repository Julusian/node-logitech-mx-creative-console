import type { KeyIndex, MXCreativeConsoleWeb } from '@logitech-mx-creative-console/webhid'

export interface Demo {
	start(device: MXCreativeConsoleWeb): Promise<void>
	stop(device: MXCreativeConsoleWeb): Promise<void>

	keyDown(device: MXCreativeConsoleWeb, keyIndex: KeyIndex): Promise<void>
	keyUp(device: MXCreativeConsoleWeb, keyIndex: KeyIndex): Promise<void>
}
