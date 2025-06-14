import type { MXCreativeConsoleWeb } from '@logitech-mx-creative-console/webhid'
import { toCanvas } from 'html-to-image'
import type { Demo } from './demo.js'

function getRandomColor() {
	const letters = '0123456789ABCDEF'
	let color = '#'
	for (let i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * 16)]
	}
	return color
}

/**
 * This demo is using html-to-image to render a div to the MXCreativeConsole.
 * Performance is not great, and the conversion library has many issues with rendering in
 * various cases, but if the source material is very controlled it could be useful.
 * It would be better to render natively on a canvas.
 */
export class DomImageDemo implements Demo {
	private element: HTMLElement | undefined
	private run = false
	private running: Promise<void> | undefined

	public async start(device: MXCreativeConsoleWeb): Promise<void> {
		const fillSize = device.calculateFillPanelDimensions()
		this.element = document.querySelector<HTMLElement>('#image-source') || undefined
		if (this.element) {
			this.element.style.display = 'block'
			if (fillSize) {
				this.element.style.width = `${fillSize.width}px`
				this.element.style.height = `${fillSize.height}px`
			}
		}

		if (!this.run) {
			this.run = true

			const runTick = () => {
				if (this.element && this.run) {
					const elm = this.element

					toCanvas(elm)
						.then(async (canvas) => {
							this.running = device.fillPanelCanvas(canvas)
							await this.running
							this.running = undefined

							// It would run smoother to set the next tick going before sending to the panel, but then it becomes a race that could go wrong
							runTick()
						})
						.catch(console.error)
				}
			}
			runTick()
		}
	}
	public async stop(device: MXCreativeConsoleWeb): Promise<void> {
		if (this.element) {
			this.element.style.display = 'none'
		}

		this.run = false

		await this.running
		await device.clearPanel()
	}
	public async keyDown(_device: MXCreativeConsoleWeb, _keyIndex: number): Promise<void> {
		if (this.element) {
			this.element.style.background = getRandomColor()
		}
	}
	public async keyUp(_device: MXCreativeConsoleWeb, _keyIndex: number): Promise<void> {
		// Nothing to do
	}
}
