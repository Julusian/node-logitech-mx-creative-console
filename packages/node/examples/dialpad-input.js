// @ts-check
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'

const devices = await listMXCreativeConsoleDevices()

const dialpad = devices.find((device) => device.model === 'mx-creative-dialpad')
if (!dialpad) throw new Error('No device found')

const device = await openMxCreativeConsole(dialpad.path)

console.log('Press the buttons or turn the dials. Press Ctrl+C to exit.')

// Keep a running total for each dial, to show how far it has been turned
/** @type {Map<number, number>} */
const dialPositions = new Map()

device.on('down', (control) => {
	console.log('%s #%d down', control.type, control.index)
})

device.on('up', (control) => {
	console.log('%s #%d up', control.type, control.index)
})

device.on('rotate', (control, amount) => {
	const position = (dialPositions.get(control.index) ?? 0) + amount
	dialPositions.set(control.index, position)

	console.log(
		'Dial #%d turned %s by %d (position %d)',
		control.index,
		amount > 0 ? 'right' : 'left',
		Math.abs(amount),
		position,
	)
})

device.on('error', (error) => {
	console.error(error)
})
