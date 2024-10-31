// @ts-check
import { openMxCreativeConsole, listMXCreativeConsoleDevices } from '../dist/index.js'

listMXCreativeConsoleDevices().then(async (devices) => {
	if (!devices[0]) throw new Error('No device found')

	openMxCreativeConsole(devices[0].path).then((keypad) => {
		keypad.on('error', (error) => {
			console.error(error)
		})

		let isFilling = false
		setInterval(() => {
			if (isFilling) return
			isFilling = true

			Promise.resolve().then(async () => {
				try {
					const r = getRandomIntInclusive(0, 255)
					const g = getRandomIntInclusive(0, 255)
					const b = getRandomIntInclusive(0, 255)
					console.log('Filling with rgb(%d, %d, %d)', r, g, b)

					for (const control of keypad.CONTROLS) {
						if (control.type === 'button' && control.feedbackType !== 'none') {
							await keypad.fillKeyColor(control.index, r, g, b)
						}
					}
				} catch (e) {
					console.error('Fill failed:', e)
				} finally {
					await new Promise((resolve) => setTimeout(resolve, 100))
					isFilling = false
				}
			})
		}, 1000 / 3)

		function getRandomIntInclusive(min, max) {
			min = Math.ceil(min)
			max = Math.floor(max)
			return Math.floor(Math.random() * (max - min + 1)) + min
		}
	})
})
