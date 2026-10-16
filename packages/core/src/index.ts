import type { HIDDevice } from './hid-device.js'
import { DeviceModelId, MODEL_NAMES } from './id.js'
import type { MXCreativeConsole } from './types.js'
import type { OpenMXConsoleOptions } from './models/base.js'
import { mxCreativeKeypadFactory, mxCreativeKeypadInitWrites } from './models/mx-creative-keypad.js'
import { mxCreativeDialpadFactory, mxCreativeDialpadInitWrites } from './models/mx-creative-dialpad.js'
import type { PropertiesService } from './services/properties/interface.js'

export * from './types.js'
export * from './id.js'
export * from './controlDefinition.js'
export type { HIDDevice, HIDDeviceInfo, HIDDeviceEvents } from './hid-device.js'
export type { OpenMXConsoleOptions } from './models/base.js'
export { MXCreativeConsoleProxy } from './proxy.js'
export type { PropertiesService } from './services/properties/interface.js'
export { uint8ArrayToDataView } from './util.js'

/** Logitech vendor id */
export const VENDOR_ID = 0x046d

/**
 * How long to leave between the writes which initialise a device.
 * A device handles one request at a time and silently drops any arriving while it is busy, so
 * writing them back to back loses roughly every other one.
 */
const INIT_WRITE_INTERVAL = 20

/**
 * How long to wait before the first write.
 * A request made as soon as the device is opened can be dropped, which over bluetooth leaves the
 * control it was enabling silently dead.
 */
const INIT_SETTLE_DELAY = 100

/**
 * Perform the writes which initialise a device, if it needs any.
 * Controls are not reported to software until these enable them, so a dropped write means a
 * control which never produces any input.
 */
export async function performInitWrites(device: HIDDevice, initWrites: Uint8Array[] | undefined): Promise<void> {
	if (!initWrites) return

	await new Promise((resolve) => setTimeout(resolve, INIT_SETTLE_DELAY))

	for (const write of initWrites) {
		await device.sendReports([write])
		await new Promise((resolve) => setTimeout(resolve, INIT_WRITE_INTERVAL))
	}
}

export interface DeviceModelSpec {
	id: DeviceModelId
	// type: DeviceModelType
	productIds: number[]
	productName: string

	factory: (
		device: HIDDevice,
		options: Required<OpenMXConsoleOptions>,
		propertiesService?: PropertiesService,
	) => MXCreativeConsole

	/**
	 * Some extra writes to do after the device is opened, to initialise it
	 */
	initWrites?: Uint8Array[]
}

/** List of all the known models, and the classes to use them */
export const DEVICE_MODELS2: { [key in DeviceModelId]: Omit<DeviceModelSpec, 'id' | 'productName'> } = {
	[DeviceModelId.MX_CREATIVE_KEYPAD]: {
		productIds: [0xc354],
		factory: mxCreativeKeypadFactory,
		initWrites: mxCreativeKeypadInitWrites,
	},
	[DeviceModelId.MX_CREATIVE_DIALPAD]: {
		productIds: [0xbc00],
		factory: mxCreativeDialpadFactory,
		initWrites: mxCreativeDialpadInitWrites,
	},
}

/** @deprecated maybe? */
export const DEVICE_MODELS: DeviceModelSpec[] = Object.entries<Omit<DeviceModelSpec, 'id' | 'productName'>>(
	DEVICE_MODELS2,
).map(([id, spec]) => {
	const modelId = id as any as DeviceModelId
	return { id: modelId, productName: MODEL_NAMES[modelId], ...spec }
})
