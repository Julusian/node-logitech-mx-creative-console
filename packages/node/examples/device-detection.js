import { usb } from 'usb'
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'
/** @type {Record<string, import('@logitech-mx-creative-console/core').MXCreativeConsole>} */
const devices = {}

async function addDevice(info) {
	const path = info.path
	devices[path] = await openMxCreativeConsole(path)

	console.log(info)
	const newInfo = await devices[path].getHidDeviceInfo()
	console.log('open info', newInfo)
	// console.log('Serial:', await devices[path].getSerialNumber())
	// console.log('Firmware:', await devices[path].getFirmwareVersion())

	// // Clear all keys
	// await devices[path].clearPanel()
	// // Fill one key in red
	// await devices[path].fillKeyColor(0, 255, 0, 0)

	// await devices[path].resetToLogo()

	devices[path].on('error', (e) => {
		console.log(e)
		// assuming any error means we lost connection
		devices[path].removeAllListeners()
		delete devices[path]
	})
	//  add any other event listeners
}

async function refresh() {
	const devices = await listMXCreativeConsoleDevices()
	devices.forEach((device) => {
		if (!devices[device.path]) {
			addDevice(device).catch((e) => console.error('Add failed:', e))
		}
	})
}
refresh()

usb.on('attach', function (e) {
	if (e.deviceDescriptor.idVendor === 0x0fd9) {
		refresh()
	}
})
usb.on('detach', function (e) {
	if (e.deviceDescriptor.idVendor === 0x0fd9) {
		console.log(`${JSON.stringify(e.deviceDescriptor)} was removed`)
		refresh()
	}
})
