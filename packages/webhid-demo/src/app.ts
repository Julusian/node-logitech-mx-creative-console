import type { MXCreativeConsoleWeb } from '@logitech-mx-creative-console/webhid'
import { requestMXCreateConsoleDevices, reopenMXCreativeCosnoleDevices } from '@logitech-mx-creative-console/webhid'
import type { Demo } from './demo/demo.js'
import { DomImageDemo } from './demo/dom.js'
import { FillWhenPressedDemo } from './demo/fill-when-pressed.js'
import { RapidFillDemo } from './demo/rapid-fill.js'
import { ChaseDemo } from './demo/chase.js'

declare const LIB_VERSION: any
if (LIB_VERSION) {
	const elm = document.querySelector('#version_str')
	if (elm) {
		elm.innerHTML = `v${LIB_VERSION}`
	}
}

function appendLog(str: string) {
	const logElm = document.getElementById('log')
	if (logElm) {
		logElm.textContent = `${str}\n${logElm.textContent ?? ''}`
	}
}

const demoSelect = document.getElementById('demo-select') as HTMLInputElement | undefined
const consentButton = document.getElementById('consent-button')

let device: MXCreativeConsoleWeb | null = null
let currentDemo: Demo = new FillWhenPressedDemo()
async function demoChange() {
	if (demoSelect) {
		console.log(`Selected demo: ${demoSelect.value}`)
		if (device) {
			await currentDemo.stop(device)
		}

		switch (demoSelect.value) {
			case 'rapid-fill':
				currentDemo = new RapidFillDemo()
				break
			case 'dom':
				currentDemo = new DomImageDemo()
				break
			case 'chase':
				currentDemo = new ChaseDemo()
				break
			case 'fill-when-pressed':
			default:
				currentDemo = new FillWhenPressedDemo()
				break
		}

		if (device) {
			await currentDemo.start(device)
		}
	}
}

async function openDevice(device: MXCreativeConsoleWeb): Promise<void> {
	const info = await device.getHidDeviceInfo()
	appendLog(`Device opened. Serial: ${info.serialNumber}`)

	device.on('down', (control) => {
		if (control.type === 'button') {
			appendLog(`Key ${control.index} down`)
			currentDemo.keyDown(device, control.index).catch(console.error)
		} else {
			appendLog(`Encoder ${control.index} down`)
		}
	})
	device.on('up', (control) => {
		if (control.type === 'button') {
			appendLog(`Key ${control.index} up`)
			currentDemo.keyUp(device, control.index).catch(console.error)
		} else {
			appendLog(`Encoder ${control.index} down`)
		}
	})
	device.on('rotate', (control, amount) => {
		appendLog(`Encoder ${control.index} rotate (${amount})`)
	})

	await currentDemo.start(device)

	// Sample actions
	await device.setBrightness(70)

	// device.fillColor(2, 255, 0, 0)
	// device.fillColor(12, 0, 0, 255)
}

if (consentButton) {
	const doLoad = async () => {
		// attempt to open a previously selected device.
		const devices = await reopenMXCreativeCosnoleDevices()
		if (devices.length > 0) {
			device = devices[0]
			openDevice(device).catch(console.error)
		}
		console.log(devices)
	}
	window.addEventListener('load', () => {
		doLoad().catch((e) => console.error(e))
	})

	const brightnessRange = document.getElementById('brightness-range') as HTMLInputElement | undefined
	if (brightnessRange) {
		brightnessRange.addEventListener('input', (_e) => {
			const value = brightnessRange.value as any as number
			if (device) {
				device.setBrightness(value).catch(console.error)
			}
		})
	}

	if (demoSelect) {
		demoSelect.addEventListener('input', () => {
			demoChange().catch(console.error)
		})
		demoChange().catch(console.error)
	}

	const consentClick = async () => {
		if (device) {
			appendLog('Closing device')
			currentDemo.stop(device).catch(console.error)
			await device.close()
			device = null
		}
		// Prompt for a device
		try {
			const devices = await requestMXCreateConsoleDevices()
			device = devices[0]
			if (devices.length === 0) {
				appendLog('No device was selected')
				return
			}
		} catch (error) {
			appendLog(`No device access granted: ${error as string}`)
			return
		}

		openDevice(device).catch(console.error)
	}
	consentButton.addEventListener('click', () => {
		consentClick().catch((e) => console.error(e))
	})

	appendLog('Page loaded')
}
