import type { HIDDevice } from './hid-device.js'
import { DeviceModelId } from './id.js'
import type { MXCreativeConsole } from './types.js'
import type { OpenMXConsoleOptions } from './models/base.js'
import type { MXConsoleModelDefinition } from './modelInfo.js'
import { DEVICE_MODEL_DEFINITIONS } from './modelInfo.js'
import type { PropertiesService } from './services/properties/interface.js'
import { HidppTransport } from './hidpp.js'
import { mxCreativeKeypadFactory, mxCreativeKeypadInitWrites } from './models/mx-creative-keypad.js'
import { mxCreativeDialpadFactory, mxCreativeDialpadInitWrites } from './models/mx-creative-dialpad.js'

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

/**
 * Constructs a MXCreativeConsole for a model, from its definition.
 * Internal: the definition carries the properties, which are not public.
 */
type MXConsoleModelFactory = (
	definition: MXConsoleModelDefinition,
	device: HIDDevice,
	transport: HidppTransport,
	options: Required<OpenMXConsoleOptions>,
) => MXCreativeConsole

/**
 * Opens a device of a known model, performing the writes the model needs to initialise it.
 * Already bound to the model it was looked up by
 */
export type MXConsoleDriver = (device: HIDDevice, options: Required<OpenMXConsoleOptions>) => Promise<MXCreativeConsole>

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

interface ModelDriverSpec {
	factory: MXConsoleModelFactory
	/** The writes to perform after the device is opened, to initialise it */
	initWrites: Uint8Array[] | null
}

const DEVICE_MODEL_DRIVER_SPECS: { [id in DeviceModelId]: ModelDriverSpec } = {
	[DeviceModelId.MX_CREATIVE_KEYPAD]: {
		factory: mxCreativeKeypadFactory,
		initWrites: mxCreativeKeypadInitWrites(
			DEVICE_MODEL_DEFINITIONS[DeviceModelId.MX_CREATIVE_KEYPAD].properties.controls,
		),
	},
	[DeviceModelId.MX_CREATIVE_DIALPAD]: {
		factory: mxCreativeDialpadFactory,
		initWrites: mxCreativeDialpadInitWrites(
			DEVICE_MODEL_DEFINITIONS[DeviceModelId.MX_CREATIVE_DIALPAD].properties.controls,
		),
	},
}

/**
 * Each factory bound to its own model definition, so a caller can never pair a
 * driver with a model it was not built for.
 */
const DEVICE_MODEL_DRIVERS: { [id in DeviceModelId]: MXConsoleDriver } = Object.freeze(
	Object.fromEntries(
		Object.values<MXConsoleModelDefinition>(DEVICE_MODEL_DEFINITIONS).map(
			(definition): [DeviceModelId, MXConsoleDriver] => {
				const spec = DEVICE_MODEL_DRIVER_SPECS[definition.info.id]

				return [
					definition.info.id,
					async (device, options) => {
						const transport = new HidppTransport(device)
						await performInitWrites(transport, spec.initWrites ?? undefined)

						return spec.factory(definition, device, transport, options)
					},
				]
			},
		),
	),
) as { [id in DeviceModelId]: MXConsoleDriver }

/**
 * Get the driver to open a device of a model.
 *
 * This is the integration point for libraries which provide their own HID implementation, and is not intended for
 * end users. The driver performs the writes the model needs to initialise it before resolving.
 */
export function getDriver(id: DeviceModelId): MXConsoleDriver | undefined {
	return DEVICE_MODEL_DRIVERS[id]
}

function createLegacySpec(definition: MXConsoleModelDefinition): Omit<DeviceModelSpec, 'id' | 'productName'> {
	const spec = DEVICE_MODEL_DRIVER_SPECS[definition.info.id]

	return {
		productIds: definition.info.usb.map((match) => match.productId),
		factory: (device, transport, options) => spec.factory(definition, device, transport, options),
		initWrites: spec.initWrites ?? undefined,
	}
}

/**
 * List of all the known models, and the classes to use them
 * @deprecated Use `DEVICE_MODEL_INFO` and {@link getDriver} instead
 */
export const DEVICE_MODELS2: { [key in DeviceModelId]: Omit<DeviceModelSpec, 'id' | 'productName'> } =
	Object.fromEntries(
		Object.values<MXConsoleModelDefinition>(DEVICE_MODEL_DEFINITIONS).map((definition) => [
			definition.info.id,
			createLegacySpec(definition),
		]),
	) as { [key in DeviceModelId]: Omit<DeviceModelSpec, 'id' | 'productName'> }

/** @deprecated Use `DEVICE_MODEL_INFO` and {@link getDriver} instead */
export const DEVICE_MODELS: DeviceModelSpec[] = Object.entries<Omit<DeviceModelSpec, 'id' | 'productName'>>(
	DEVICE_MODELS2,
).map(([id, spec]) => {
	const modelId = id as any as DeviceModelId
	return { id: modelId, productName: DEVICE_MODEL_DEFINITIONS[modelId].info.name, ...spec }
})
