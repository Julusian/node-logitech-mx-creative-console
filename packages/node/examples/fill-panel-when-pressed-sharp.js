// @ts-check
import sharp from 'sharp'
import { listMXCreativeConsoleDevices, openMxCreativeConsole } from '../dist/index.js'
import { fileURLToPath } from 'url'

console.log('Press different keys to show each image.')
;(async () => {
	const devices = await listMXCreativeConsoleDevices()
	if (!devices[0]) throw new Error('No device found')

	const device = await openMxCreativeConsole(devices[0].path)
	await device.clearPanel()

	const panelDimensions = device.calculateFillPanelDimensions()
	if (!panelDimensions) throw new Error("Streamdeck doesn't support fillPanel")

	// await device.resetToLogo()

	// streamDeck.getSerialNumber().then((ser) => {
	// 	console.log('serial', ser)
	// })
	// streamDeck.getFirmwareVersion().then((ser) => {
	// 	console.log('firmware', ser)
	// })

	console.log('fill dimensions', panelDimensions)

	device.getHidDeviceInfo().then((ser) => {
		console.log('hid', ser)
	})

	const buttonCount = device.CONTROLS.filter((control) => control.type === 'button').length

	const imgField = await sharp(fileURLToPath(new URL('fixtures/sunny_field.png', import.meta.url)))
		.flatten()
		.resize(panelDimensions.width, panelDimensions.height)
		.raw()
		.toBuffer()
	const imgMosaic = await sharp(fileURLToPath(new URL('../../../fixtures/mosaic.png', import.meta.url)))
		.flatten()
		.resize(panelDimensions.width, panelDimensions.height)
		.raw()
		.toBuffer()

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

		device.fillPanelBuffer(image).catch((e) => console.error('Fill failed:', e))
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
})()
