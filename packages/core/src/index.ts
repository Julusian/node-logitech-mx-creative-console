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
 * How long to wait before the first write.
 * A request made as soon as the device is opened can be dropped, which over bluetooth leaves the
 * control it was enabling silently dead.
 */
const INIT_SETTLE_DELAY = 100

/**
 * How long to wait for a device to answer an init write before sending it again.
 * A device handles one request at a time and silently drops any arriving while it is busy, or
 * while it is still waking up, so the only way to know a write took effect is its answer.
 */
const INIT_RESPONSE_TIMEOUT = 250
const INIT_WRITE_ATTEMPTS = 3

const HIDPP_SHORT_REPORT_ID = 0x10
const HIDPP_LONG_REPORT_ID = 0x11
/** The feature index an error answer carries, followed by the feature index and function it is for */
const HIDPP_ERROR_FEATURE_INDEX = 0xff

/**
 * Whether an input report answers a HID++ request.
 * A successful answer echoes the device index, feature index and function/software id of the request,
 * while an error answer carries them after the error marker.
 */
function isHidppAnswer(request: Uint8Array, reportId: number, data: Uint8Array): boolean {
	if (reportId !== HIDPP_SHORT_REPORT_ID && reportId !== HIDPP_LONG_REPORT_ID) return false
	if (data[0] !== request[1]) return false

	if (data[1] === request[2] && data[2] === request[3]) return true
	return data[1] === HIDPP_ERROR_FEATURE_INDEX && data[2] === request[2] && data[3] === request[3]
}

/** Send a HID++ request, resolving once the device answers it, or false if it never does */
async function sendHidppRequest(device: HIDDevice, request: Uint8Array): Promise<boolean> {
	for (let attempt = 0; attempt < INIT_WRITE_ATTEMPTS; attempt++) {
		const answered = Promise.withResolvers<boolean>()
		const onInput = (reportId: number, data: Uint8Array) => {
			if (isHidppAnswer(request, reportId, data)) answered.resolve(true)
		}
		const timeout = setTimeout(() => answered.resolve(false), INIT_RESPONSE_TIMEOUT)

		device.on('input', onInput)
		try {
			await device.sendReports([request])
			if (await answered.promise) return true
		} finally {
			device.off('input', onInput)
			clearTimeout(timeout)
		}
	}

	return false
}

/**
 * Perform the writes which initialise a device, if it needs any.
 * Controls are not reported to software until these enable them, so a dropped write means a
 * control which never produces any input. Each is resent until the device answers it.
 */
export async function performInitWrites(device: HIDDevice, initWrites: Uint8Array[] | undefined): Promise<void> {
	if (!initWrites) return

	await new Promise((resolve) => setTimeout(resolve, INIT_SETTLE_DELAY))

	for (const write of initWrites) {
		await sendHidppRequest(device, write)
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
