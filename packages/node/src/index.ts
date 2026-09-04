import type { OpenMXConsoleOptions, MXCreativeConsole } from '@logitech-mx-creative-console/core'
import { DEVICE_MODELS, VENDOR_ID, performInitWrites } from '@logitech-mx-creative-console/core'
import * as HID from 'node-hid'
import type { NodeHIDCollection } from './hid-device.js'
import { NodeHIDDevice, MXCreativeConsoleDeviceInfo } from './hid-device.js'
import { MXCreativeConsoleNode } from './wrapper.js'
import { encodeJPEG, JPEGEncodeOptions } from './jpeg.js'
import { findDeviceCollections, isPrimaryCollection } from './collections.js'

export {
	VENDOR_ID,
	DeviceModelId,
	MODEL_NAMES,
	KeyIndex,
	MXCreativeConsole,
	LcdPosition,
	Dimension,
	MXConsoleControlDefinitionBase,
	MXConsoleButtonControlDefinition,
	MXConsoleButtonControlDefinitionNoFeedback,
	MXConsoleEncoderControlDefinition,
	MXConsoleControlDefinition,
	OpenMXConsoleOptions,
} from '@logitech-mx-creative-console/core'

export { MXCreativeConsoleDeviceInfo, JPEGEncodeOptions }

export interface OpenMXCreativeConsoleOptionsNode extends OpenMXConsoleOptions {
	jpegOptions?: JPEGEncodeOptions
	resetToLogoOnClose?: boolean
}

/**
 * Scan for and list detected devices
 */
export async function listMXCreativeConsoleDevices(): Promise<MXCreativeConsoleDeviceInfo[]> {
	const devices: MXCreativeConsoleDeviceInfo[] = []
	for (const dev of await HID.devicesAsync()) {
		const info = getMXCreativeConsoleDeviceInfo(dev)
		if (info) devices.push(info)
	}
	return devices
}

/**
 * If the provided device is a mx creative console, get the info about it.
 * Only the collection identifying the device is reported, so that a device split across multiple
 * collections is not mistaken for multiple devices.
 */
export function getMXCreativeConsoleDeviceInfo(dev: HID.Device): MXCreativeConsoleDeviceInfo | null {
	const model = DEVICE_MODELS.find((m) => m.productIds.includes(dev.productId))

	if (model && dev.vendorId === VENDOR_ID && dev.path && isPrimaryCollection(dev)) {
		return { model: model.id, path: dev.path, serialNumber: dev.serialNumber }
	} else {
		return null
	}
}

/**
 * Get the info of a device if the given path is a mx creative console
 */
export async function getMXCreativeConsoleInfo(path: string): Promise<MXCreativeConsoleDeviceInfo | undefined> {
	const allDevices = await listMXCreativeConsoleDevices()
	return allDevices.find((dev) => dev.path === path)
}

/**
 * Open a mx creative console
 * @param devicePath The path of the device to open.
 * @param userOptions Options to customise the device behvaiour
 */
export async function openMxCreativeConsole(
	devicePath: string,
	userOptions?: OpenMXCreativeConsoleOptionsNode,
): Promise<MXCreativeConsole> {
	// Clone the options, to ensure they dont get changed
	const jpegOptions: JPEGEncodeOptions | undefined = userOptions?.jpegOptions
		? { ...userOptions.jpegOptions }
		: undefined

	const options: Required<OpenMXConsoleOptions> = {
		encodeJPEG: async (buffer: Uint8Array, width: number, height: number) =>
			encodeJPEG(buffer, width, height, jpegOptions),
		...userOptions,
	}

	const collections: NodeHIDCollection[] = []
	try {
		// The device may be split across multiple collections, which must all be opened to talk to it
		for (const collection of findDeviceCollections(await HID.devicesAsync(), devicePath)) {
			collections.push({
				handle: await HID.HIDAsync.open(collection.path),
				reportIds: collection.reportIds,
			})
		}

		const device = new NodeHIDDevice(collections)

		const deviceInfo = await device.getDeviceInfo()

		const model = DEVICE_MODELS.find(
			(m) => deviceInfo.vendorId === VENDOR_ID && m.productIds.includes(deviceInfo.productId),
		)
		if (!model) {
			throw new Error('MX Creative Console is of unexpected type.')
		}

		await performInitWrites(device, model.initWrites)

		const rawDevice = model.factory(device, options)
		return new MXCreativeConsoleNode(rawDevice, userOptions?.resetToLogoOnClose ?? false)
	} catch (e) {
		await Promise.all(collections.map(async ({ handle }) => handle.close().catch(() => null))) // Suppress error
		throw e
	}
}
