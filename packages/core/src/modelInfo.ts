import type { MXConsoleControlDefinition } from './controlDefinition.js'
import { DeviceModelId } from './id.js'
import type { Dimension } from './id.js'
import type { MXConsoleProperties, MXConsoleStaticProperties } from './models/base.js'
import { dialpadProperties, keypadProperties } from './models/definitions.js'

/** Logitech vendor id */
export const VENDOR_ID = 0x046d

const MANUFACTURER_LOGITECH = 'Logitech'

/** A transport which a device can be connected over */
export type MXConsoleTransport = 'usb' | 'bluetooth'

/** The properties of a usb device which identify it as a model */
export interface UsbMatch {
	vendorId: number
	productId: number
	/**
	 * If needing to filter by usage
	 */
	hidUsage?: number
	/**
	 * If needing to filter by interface number
	 */
	hidInterface?: number
}

/** The optional capabilities of a model */
export interface MXConsoleModelFeatures {
	/** Whether the brightness of the display can be set */
	brightness: boolean
}

/**
 * Static information about a model of MX Creative Console.
 * This holds no functions, so can be consumed without pulling in the code needed to drive a device.
 */
export interface MXConsoleModelInfo {
	id: DeviceModelId
	name: string
	manufacturer: string

	/**
	 * The usb devices which identify as this model.
	 * Over bluetooth these models report their ids as a HID device, so these identify them there too
	 */
	usb: readonly UsbMatch[]
	/** The transports this model can be connected over */
	transports: readonly MXConsoleTransport[]

	controls: Readonly<MXConsoleControlDefinition[]>

	/** The extent of the face, which every control's `bounds` is within */
	faceSize: Dimension

	features: MXConsoleModelFeatures
}

/**
 * A model's public info, paired with the properties needed to drive it.
 *
 * The two are built together from a single source, so they cannot describe
 * different models. The properties are internal and are never exported from
 * the package index.
 * @internal
 */
export interface MXConsoleModelDefinition {
	readonly info: MXConsoleModelInfo
	readonly properties: MXConsoleProperties
}

interface ModelInfoOptions {
	usb: UsbMatch[]
	transports: MXConsoleTransport[]
}

function createModelDefinition(
	id: DeviceModelId,
	name: string,
	properties: MXConsoleStaticProperties,
	options: ModelInfoOptions,
): MXConsoleModelDefinition {
	const info: MXConsoleModelInfo = Object.freeze({
		id,
		name,
		manufacturer: MANUFACTURER_LOGITECH,

		usb: Object.freeze(options.usb.map((match) => Object.freeze(match))),
		transports: Object.freeze([...options.transports]),

		controls: properties.controls,
		faceSize: Object.freeze({ ...properties.faceSize }),

		features: Object.freeze({
			brightness: properties.supportsBrightness,
		}),
	})

	return Object.freeze({
		info,
		properties: Object.freeze({ ...properties, model: id, productName: name }),
	})
}

/**
 * Every known model, as its public info paired with the properties to drive it.
 * @internal
 */
export const DEVICE_MODEL_DEFINITIONS: Readonly<{ [id in DeviceModelId]: MXConsoleModelDefinition }> = Object.freeze({
	[DeviceModelId.MX_CREATIVE_KEYPAD]: createModelDefinition(
		DeviceModelId.MX_CREATIVE_KEYPAD,
		'MX Creative Keypad',
		keypadProperties,
		{
			usb: [{ vendorId: VENDOR_ID, productId: 0xc354 }],
			transports: ['usb'],
		},
	),
	[DeviceModelId.MX_CREATIVE_DIALPAD]: createModelDefinition(
		DeviceModelId.MX_CREATIVE_DIALPAD,
		'MX Creative Dialpad',
		dialpadProperties,
		{
			// The ids it reports over bluetooth
			usb: [{ vendorId: VENDOR_ID, productId: 0xbc00 }],
			transports: ['bluetooth'],
		},
	),
})

/**
 * Static information about every known model.
 */
export const DEVICE_MODELS: Readonly<{ [id in DeviceModelId]: MXConsoleModelInfo }> = Object.freeze(
	Object.fromEntries(
		Object.values<MXConsoleModelDefinition>(DEVICE_MODEL_DEFINITIONS).map((definition) => [
			definition.info.id,
			definition.info,
		]),
	),
) as Readonly<{ [id in DeviceModelId]: MXConsoleModelInfo }>

const ALL_MODEL_INFO: readonly MXConsoleModelInfo[] = Object.freeze(Object.values<MXConsoleModelInfo>(DEVICE_MODELS))

/**
 * Get the information about a model, if it is known
 */
export function getModelInfo(id: DeviceModelId): MXConsoleModelInfo | undefined {
	return DEVICE_MODELS[id]
}

/**
 * Find the model which a usb device identifies as, if any.
 * The `usage` and `hidInterface` are only checked when both the model requires it, and a value is provided.
 */
export function findModelByUsb(
	vendorId: number,
	productId: number,
	usage?: number,
	hidInterface?: number,
): MXConsoleModelInfo | undefined {
	for (const model of ALL_MODEL_INFO) {
		for (const match of model.usb) {
			if (match.vendorId !== vendorId || match.productId !== productId) continue
			if (match.hidUsage !== undefined && usage !== undefined && usage !== match.hidUsage) continue
			if (match.hidInterface !== undefined && hidInterface !== undefined && hidInterface !== match.hidInterface)
				continue

			return model
		}
	}

	return undefined
}
