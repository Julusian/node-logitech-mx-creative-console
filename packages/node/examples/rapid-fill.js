// @ts-check
import { openMxCreativeConsole, listMXCreativeConsoleDevices } from '../dist/index.js'

listMXCreativeConsoleDevices().then(async (devices) => {
	const dialpad = devices.find((device) => device.modelInfo.id === 'mx-creative-keypad')
	if (!dialpad) throw new Error('No device found')

	openMxCreativeConsole(dialpad.path).then((keypad) => {
		keypad.on('error', (error) => {
			console.error(error)
		})

		let isFilling = false
		const interval = setInterval(() => {
			if (isFilling) return
			isFilling = true

			Promise.resolve().then(async () => {
				try {
					const r = getRandomIntInclusive(0, 255)
					const g = getRandomIntInclusive(0, 255)
					const b = getRandomIntInclusive(0, 255)
					console.log('Filling with rgb(%d, %d, %d)', r, g, b)

					const ps = []

					for (const control of keypad.modelInfo.controls) {
						if (control.type === 'button' && control.feedbackType !== 'none') {
							ps.push(keypad.fillKeyColor(control.index, r, g, b))
						}
					}

					await Promise.all(ps)
				} catch (e) {
					console.error('Fill failed:', e)
				} finally {
					isFilling = false
				}
			})
		}, 1000 / 10)

		keypad.on('error', () => {
			clearInterval(interval)
		})

		function getRandomIntInclusive(min, max) {
			min = Math.ceil(min)
			max = Math.floor(max)
			return Math.floor(Math.random() * (max - min + 1)) + min
		}
	})
})
