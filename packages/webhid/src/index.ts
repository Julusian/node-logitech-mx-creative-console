/* eslint-disable n/no-unsupported-features/node-builtins */

import type { OpenMXConsoleOptions, MXCreativeConsole } from '@logitech-mx-creative-console/core'
import { DEVICE_MODELS, VENDOR_ID } from '@logitech-mx-creative-console/core'
import { WebHIDDevice } from './hid-device.js'
import { encodeJPEG } from './jpeg.js'
import { MXCreativeConsoleWeb } from './wrapper.js'

export {
	VENDOR_ID,
	DeviceModelId,
	KeyIndex,
	MXCreativeConsole,
	LcdPosition,
	Dimension,
	MXConsoleControlDefinitionBase,
	MXConsoleButtonControlDefinition,
	MXConsoleButtonControlDefinitionNoFeedback,
	MXConsoleButtonControlDefinitionLcdFeedback,
	MXConsoleEncoderControlDefinition,
	MXConsoleControlDefinition,
	OpenMXConsoleOptions,
} from '@logitech-mx-creative-console/core'
export { MXCreativeConsoleWeb as MXCreativeConsoleWeb } from './wrapper.js'

/**
 * Request the user to select some MXConsoles to open
 * @param userOptions Options to customise the device behvaiour
 */
export async function requestMXCreateConsoleDevices(options?: OpenMXConsoleOptions): Promise<MXCreativeConsoleWeb[]> {
	// TODO - error handling
	const browserDevices = await navigator.hid.requestDevice({ filters: [{ vendorId: VENDOR_ID }] })

	return Promise.all(browserDevices.map(async (dev) => openDevice(dev, options)))
}

/**
 * Reopen previously selected MXConsoles.
 * The browser remembers what the user previously allowed your site to access, and this will open those without the request dialog
 * @param options Options to customise the device behvaiour
 */
export async function reopenMXCreativeCosnoleDevices(options?: OpenMXConsoleOptions): Promise<MXCreativeConsoleWeb[]> {
	const browserDevices = await navigator.hid.getDevices()
	const validDevices = browserDevices.filter((d) => d.vendorId === VENDOR_ID)

	const resultDevices = await Promise.all(
		validDevices.map(async (dev) => openDevice(dev, options).catch((_) => null)), // Ignore failures
	)

	return resultDevices.filter((v): v is MXCreativeConsoleWeb => !!v)
}

/**
 * Open a MXConsole from a manually selected HIDDevice handle
 * @param browserDevice The unopened browser HIDDevice
 * @param userOptions Options to customise the device behvaiour
 */
export async function openDevice(
	browserDevice: HIDDevice,
	userOptions?: OpenMXConsoleOptions,
): Promise<MXCreativeConsoleWeb> {
	const model = DEVICE_MODELS.find(
		(m) => browserDevice.vendorId === VENDOR_ID && m.productIds.includes(browserDevice.productId),
	)
	if (!model) {
		throw new Error('Stream Deck is of unexpected type.')
	}

	await browserDevice.open()

	try {
		const options: Required<OpenMXConsoleOptions> = { encodeJPEG: encodeJPEG, ...userOptions }

		const browserHid = new WebHIDDevice(browserDevice)

		if (model.initWrites) await browserHid.sendReports(model.initWrites)

		const device: MXCreativeConsole = model.factory(browserHid, options || {})
		return new MXCreativeConsoleWeb(device, browserHid)
	} catch (e) {
		await browserDevice.close().catch(() => null) // Suppress error

		throw e
	}
}
