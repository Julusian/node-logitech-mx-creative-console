// @ts-check
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'

const devices = await listMXCreativeConsoleDevices()
if (!devices[0]) throw new Error('No device found')

const device = await openMxCreativeConsole(devices[0].path)

// Fill it white so we can see the brightness changes
const buttonControls = device.CONTROLS.filter((control) => control.type === 'button')
for (const control of device.CONTROLS) {
	if (control.type === 'button' && control.feedbackType !== 'none') {
		device.fillKeyColor(control.index, 255, 255, 255).catch((e) => console.error('Fill failed:', e))
	}
}

device.on('down', (control) => {
	if (control.type !== 'button') return

	const percentage = (100 / (buttonControls.length - 1)) * control.index
	console.log(`Setting brightness to ${percentage.toFixed(2)}%`)
	device.setBrightness(percentage).catch((e) => console.error('Set brightness failed:', e))
})

device.on('error', (error) => {
	console.error(error)
})
