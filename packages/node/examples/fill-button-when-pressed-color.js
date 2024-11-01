// @ts-check
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'

const devices = await listMXCreativeConsoleDevices()
if (!devices[0]) throw new Error('No device found')

const device = await openMxCreativeConsole(devices[0].path)
await device.clearPanel()

device.on('down', (control) => {
	if (control.type !== 'button') return

	// Fill the pressed key with an image of the GitHub logo.
	console.log('Filling button #%d', control.index)
	device.fillKeyColor(control.index, 255, 0, 0).catch((e) => console.error('Fill failed:', e))
})

device.on('up', (control) => {
	if (control.type !== 'button') return

	// Clear the key when it is released.
	console.log('Clearing button #%d', control.index)
	device.clearKey(control.index).catch((e) => console.error('Clear failed:', e))
})

device.on('error', (error) => {
	console.error(error)
})
