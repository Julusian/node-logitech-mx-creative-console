import type { KeyIndex, StreamDeckWeb } from '@logitech-mx-creative-console/webhid'

export interface Demo {
	start(device: StreamDeckWeb): Promise<void>
	stop(device: StreamDeckWeb): Promise<void>

	keyDown(device: StreamDeckWeb, keyIndex: KeyIndex): Promise<void>
	keyUp(device: StreamDeckWeb, keyIndex: KeyIndex): Promise<void>
}
