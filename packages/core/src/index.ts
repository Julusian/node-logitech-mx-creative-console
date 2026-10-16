import type { HIDDevice } from './hid-device.js'
import { DeviceModelId, MODEL_NAMES } from './id.js'
import type { MXCreativeConsole } from './types.js'
import type { OpenMXConsoleOptions } from './models/base.js'
import { mxCreativeKeypadFactory, mxCreativeKeypadInitWrites } from './models/mx-creative-keypad.js'
import { mxCreativeDialpadFactory, mxCreativeDialpadInitWrites } from './models/mx-creative-dialpad.js'
import type { PropertiesService } from './services/properties/interface.js'
import type { HidppTransport } from './hidpp.js'

export * from './types.js'
export * from './id.js'
export * from './controlDefinition.js'
export type { HIDDevice, HIDDeviceInfo, HIDDeviceEvents } from './hid-device.js'
export type { OpenMXConsoleOptions, EncodeJPEGHelper, EncodeJPEGHelperOptions } from './models/base.js'
export { MXCreativeConsoleProxy } from './proxy.js'
export { HidppTransport, HidppError, HidppTimeoutError, type HidppRequestOptions } from './hidpp.js'
export type { PropertiesService } from './services/properties/interface.js'
export { uint8ArrayToDataView } from './util.js'

/** Logitech vendor id */
export const VENDOR_ID = 0x046d

/**
 * How long to wait before the first write.
 * A request made as soon as the device is opened can be dropped, which over bluetooth leaves the
 * control it was enabling silently dead.
 */
const INIT_SETTLE_DELAY = 100

/**
 * How long to wait for a device to answer an init write before sending it again.
 * A write arriving while the device is still waking up is silently dropped.
 */
const INIT_RESPONSE_TIMEOUT = 250
const INIT_WRITE_ATTEMPTS = 3

/**
 * Perform the writes which initialise a device, if it needs any.
 * Controls are not reported to software until these enable them, so a dropped write means a
 * control which never produces any input. Each is resent until the device answers it.
 */
export async function performInitWrites(
	transport: HidppTransport,
	initWrites: Uint8Array[] | undefined,
): Promise<void> {
	if (!initWrites) return

	await new Promise((resolve) => setTimeout(resolve, INIT_SETTLE_DELAY))

	for (const write of initWrites) {
		// A control which never got enabled is not worth failing the open for
		await transport
			.request(write, { timeout: INIT_RESPONSE_TIMEOUT, attempts: INIT_WRITE_ATTEMPTS })
			.catch(() => undefined)
	}
}

export interface DeviceModelSpec {
	id: DeviceModelId
	// type: DeviceModelType
	productIds: number[]
	productName: string

	factory: (
		device: HIDDevice,
		transport: HidppTransport,
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
