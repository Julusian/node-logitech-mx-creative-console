// @ts-check
import { Jimp } from 'jimp'
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'
import { fileURLToPath } from 'url'

const devices = await listMXCreativeConsoleDevices()
if (!devices[0]) throw new Error('No device found')

const device = await openMxCreativeConsole(devices[0].path)
await device.clearPanel()

const bmpImg = await Jimp.read(fileURLToPath(new URL('fixtures/github_logo.png', import.meta.url))).then((img) => {
	return img.resize({ w: 118, h: 118 }) // TODO - dynamic
})

const img = bmpImg.bitmap.data

device.on('down', (control) => {
	if (control.type !== 'button') return

	// Fill the pressed key with an image of the GitHub logo.
	console.log('Filling button #%d', control.index)
	if (control.feedbackType === 'lcd') {
		device.fillKeyBuffer(control.index, img, { format: 'rgba' }).catch((e) => console.error('Fill failed:', e))
	}
})

device.on('up', (control) => {
	if (control.type !== 'button') return

	// Clear the key when it is released.
	console.log('Clearing button #%d', control.index)
	if (control.feedbackType === 'lcd') {
		device.clearKey(control.index).catch((e) => console.error('Clear failed:', e))
	}
})

device.on('error', (error) => {
	console.error(error)
})
