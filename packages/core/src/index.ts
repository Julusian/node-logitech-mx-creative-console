import type { HIDDevice } from './hid-device.js'
import { DeviceModelId, MODEL_NAMES } from './id.js'
import type { MXCreativeConsole } from './types.js'
import type { OpenStreamDeckOptions } from './models/base.js'
import { mxCreativeKeypadFactory } from './models/mx-creative-keypad.js'
import type { PropertiesService } from './services/properties/interface.js'

export * from './types.js'
export * from './id.js'
export * from './controlDefinition.js'
export type { HIDDevice, HIDDeviceInfo, HIDDeviceEvents } from './hid-device.js'
export type { OpenStreamDeckOptions } from './models/base.js'
export { MXCreativeConsoleProxy } from './proxy.js'
export type { PropertiesService } from './services/properties/interface.js'
export { uint8ArrayToDataView } from './util.js'

/** Logitech vendor id */
export const VENDOR_ID = 0x046d

// export enum DeviceModelType {
// 	STREAMDECK = 'streamdeck',
// 	PEDAL = 'pedal',
// }

export interface DeviceModelSpec {
	id: DeviceModelId
	// type: DeviceModelType
	productIds: number[]
	productName: string

	factory: (
		device: HIDDevice,
		options: Required<OpenStreamDeckOptions>,
		propertiesService?: PropertiesService,
	) => MXCreativeConsole
}

/** List of all the known models, and the classes to use them */
export const DEVICE_MODELS2: { [key in DeviceModelId]: Omit<DeviceModelSpec, 'id' | 'productName'> } = {
	[DeviceModelId.MX_CREATIVE_KEYPAD]: {
		// type: DeviceModelType.STREAMDECK,
		productIds: [0xc354],
		factory: mxCreativeKeypadFactory,
	},
}

/** @deprecated maybe? */
export const DEVICE_MODELS: DeviceModelSpec[] = Object.entries<Omit<DeviceModelSpec, 'id' | 'productName'>>(
	DEVICE_MODELS2,
).map(([id, spec]) => {
	const modelId = id as any as DeviceModelId
	return {
		id: modelId,
		productName: MODEL_NAMES[modelId],
		...spec,
	}
})
