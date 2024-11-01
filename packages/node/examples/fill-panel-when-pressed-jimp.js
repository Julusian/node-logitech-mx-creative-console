// @ts-check
import path from 'path'
import { Jimp } from 'jimp'
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'
import { fileURLToPath } from 'url'

console.log('Press keys 0-7 to show the first image, and keys 8-15 to show the second image.')
const devices = await listMXCreativeConsoleDevices()
if (!devices[0]) throw new Error('No device found')

const device = await openMxCreativeConsole(devices[0].path)
await device.clearPanel()

const panelDimensions = device.calculateFillPanelDimensions()
if (!panelDimensions) throw new Error("Streamdeck doesn't support fillPanel")

const bmpImgField = await Jimp.read(fileURLToPath(new URL('fixtures/sunny_field.png', import.meta.url))).then((img) => {
	return img.resize({ w: panelDimensions.width, h: panelDimensions.height })
})
const bmpImgMosaic = await Jimp.read(fileURLToPath(new URL('../../../fixtures/mosaic.png', import.meta.url))).then(
	(img) => {
		return img.resize({ w: panelDimensions.width, h: panelDimensions.height })
	},
)

const buttonCount = device.CONTROLS.filter((control) => control.type === 'button').length

const imgField = bmpImgField.bitmap.data
const imgMosaic = bmpImgMosaic.bitmap.data

let filled = false
device.on('down', (control) => {
	if (control.type !== 'button') return

	if (filled) return

	filled = true

	let image
	if (control.index > buttonCount / 2) {
		console.log('Filling entire panel with an image of a sunny field.')
		image = imgField
	} else {
		console.log('Filling entire panel with a mosaic which will show each key as a different color.')
		image = imgMosaic
	}

	device.fillPanelBuffer(image, { format: 'rgba' }).catch((e) => console.error('Fill failed:', e))
})

device.on('up', () => {
	if (!filled) {
		return
	}

	// Clear the key when any key is released.
	console.log('Clearing all buttons')
	device.clearPanel().catch((e) => console.error('Clear failed:', e))
	filled = false
})

device.on('error', (error) => {
	console.error(error)
})
