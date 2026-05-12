// @ts-check

/**
 * Generate a mosaic RGBA buffer where each LCD button cell is filled with a random solid color.
 *
 * @param {import('../dist/index.js').MXCreativeConsole['CONTROLS']} controls
 * @param {{ width: number, height: number }} panelDimensions
 * @returns {Uint8ClampedArray} RGBA image buffer
 */
export function generateMosaicBuffer(controls, panelDimensions) {
	const buttonLcdControls = controls.filter((control) => control.type === 'button' && control.feedbackType === 'lcd')

	const minRow = Math.min(...buttonLcdControls.map((c) => c.row))
	const minCol = Math.min(...buttonLcdControls.map((c) => c.column))
	const cellWidth = buttonLcdControls[0]?.pixelSize.width ?? 0
	const cellHeight = buttonLcdControls[0]?.pixelSize.height ?? 0

	const buffer = new Uint8ClampedArray(panelDimensions.width * panelDimensions.height * 4)

	for (const control of buttonLcdControls) {
		const r = Math.floor(Math.random() * 256)
		const g = Math.floor(Math.random() * 256)
		const b = Math.floor(Math.random() * 256)
		const xStart = (control.column - minCol) * cellWidth
		const yStart = (control.row - minRow) * cellHeight

		for (let py = yStart; py < yStart + cellHeight; py++) {
			for (let px = xStart; px < xStart + cellWidth; px++) {
				const idx = (py * panelDimensions.width + px) * 4
				buffer[idx] = r
				buffer[idx + 1] = g
				buffer[idx + 2] = b
				buffer[idx + 3] = 255
			}
		}
	}

	return buffer
}
