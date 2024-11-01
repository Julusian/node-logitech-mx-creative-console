import type { OpenStreamDeckOptions, MXCreativeConsole } from '@logitech-mx-creative-console/core'
import { DEVICE_MODELS, VENDOR_ID } from '@logitech-mx-creative-console/core'
import * as HID from 'node-hid'
import { NodeHIDDevice, MXCreativeConsoleDeviceInfo } from './hid-device.js'
import { MXCreativeConsoleNode } from './wrapper.js'
import { encodeJPEG, JPEGEncodeOptions } from './jpeg.js'

export {
	VENDOR_ID,
	DeviceModelId,
	KeyIndex,
	MXCreativeConsole as StreamDeck,
	LcdPosition,
	Dimension,
	StreamDeckControlDefinitionBase,
	StreamDeckButtonControlDefinition,
	StreamDeckButtonControlDefinitionNoFeedback,
	StreamDeckEncoderControlDefinition,
	StreamDeckControlDefinition,
	OpenStreamDeckOptions,
} from '@logitech-mx-creative-console/core'

export { MXCreativeConsoleDeviceInfo, JPEGEncodeOptions }

export interface OpenMXCreativeConsoleOptionsNode extends OpenStreamDeckOptions {
	jpegOptions?: JPEGEncodeOptions
	resetToLogoOnClose?: boolean
}

/**
 * Scan for and list detected devices
 */
export async function listMXCreativeConsoleDevices(): Promise<MXCreativeConsoleDeviceInfo[]> {
	const devices: Record<string, MXCreativeConsoleDeviceInfo> = {}
	for (const dev of await HID.devicesAsync()) {
		if (dev.path && !devices[dev.path]) {
			const info = getMXCreativeConsoleDeviceInfo(dev)
			if (info) devices[dev.path] = info
		}
	}
	return Object.values<MXCreativeConsoleDeviceInfo>(devices)
}

/**
 * If the provided device is a mx creative console, get the info about it
 */
export function getMXCreativeConsoleDeviceInfo(dev: HID.Device): MXCreativeConsoleDeviceInfo | null {
	const model = DEVICE_MODELS.find((m) => m.productIds.includes(dev.productId))

	if (model && dev.vendorId === VENDOR_ID && dev.path) {
		return {
			model: model.id,
			path: dev.path,
			serialNumber: dev.serialNumber,
		}
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

	const options: Required<OpenStreamDeckOptions> = {
		encodeJPEG: async (buffer: Uint8Array, width: number, height: number) =>
			encodeJPEG(buffer, width, height, jpegOptions),
		...userOptions,
	}

	let device: NodeHIDDevice | undefined
	try {
		const hidDevice = await HID.HIDAsync.open(devicePath)
		device = new NodeHIDDevice(hidDevice)

		const deviceInfo = await device.getDeviceInfo()

		const model = DEVICE_MODELS.find(
			(m) => deviceInfo.vendorId === VENDOR_ID && m.productIds.includes(deviceInfo.productId),
		)
		if (!model) {
			throw new Error('MX Creative Console is of unexpected type.')
		}

		if (model.initWrites) await device.sendReports(model.initWrites)

		const rawDevice = model.factory(device, options)
		return new MXCreativeConsoleNode(rawDevice, userOptions?.resetToLogoOnClose ?? false)
	} catch (e) {
		if (device) await device.close().catch(() => null) // Suppress error
		throw e
	}
}
