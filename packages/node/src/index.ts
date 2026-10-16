import type {
	OpenMXConsoleOptions,
	MXCreativeConsole,
	EncodeJPEGHelperOptions,
} from '@logitech-mx-creative-console/core'
import { findModelByUsb, getDriver } from '@logitech-mx-creative-console/core'
import * as HID from 'node-hid'
import { NodeHIDDevice, MXCreativeConsoleDeviceInfo } from './hid-device.js'
import { MXCreativeConsoleNode } from './wrapper.js'
import { encodeJPEG, JPEGEncodeOptions } from './jpeg.js'

export {
	VENDOR_ID,
	DeviceModelId,
	KeyIndex,
	MXCreativeConsole,
	LcdPosition,
	Dimension,
	MXConsoleControlBounds,
	MXConsoleControlDefinitionBase,
	MXConsoleButtonControlDefinition,
	MXConsoleButtonControlDefinitionNoFeedback,
	MXConsoleButtonControlDefinitionLcdFeedback,
	MXConsoleEncoderControlDefinition,
	MXConsoleControlDefinition,
	OpenMXConsoleOptions,
	MXConsoleModelInfo,
	MXConsoleModelFeatures,
	MXConsoleTransport,
	UsbMatch,
	DEVICE_MODELS,
	getModelInfo,
	findModelByUsb,
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
	const model = findModelByUsb(dev.vendorId, dev.productId, dev.usage, dev.interface)
	if (!model || !dev.path) return null

	return { modelInfo: model, path: dev.path, serialNumber: dev.serialNumber }
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
		encodeJPEG: async (
			buffer: Uint8Array,
			width: number,
			height: number,
			helperOptions?: EncodeJPEGHelperOptions,
		) =>
			encodeJPEG(
				buffer,
				width,
				height,
				helperOptions?.quality !== undefined ? { ...jpegOptions, quality: helperOptions.quality } : jpegOptions,
			),
		...userOptions,
	}

	let device: NodeHIDDevice | undefined
	try {
		const hidDevice = await HID.HIDAsync.open(devicePath)
		device = new NodeHIDDevice(hidDevice)

		const deviceInfo = await device.getDeviceInfo()

		const model = findModelByUsb(deviceInfo.vendorId, deviceInfo.productId)
		const driver = model && getDriver(model.id)
		if (!driver) {
			throw new Error('MX Creative Console is of unexpected type.')
		}

		const rawDevice = await driver(device, options)
		return new MXCreativeConsoleNode(rawDevice, userOptions?.resetToLogoOnClose ?? false)
	} catch (e) {
		if (device) await device.close().catch(() => null) // Suppress error
		throw e
	}
}
