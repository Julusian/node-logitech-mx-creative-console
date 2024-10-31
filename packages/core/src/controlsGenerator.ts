import type { StreamDeckButtonControlDefinition, StreamDeckControlDefinition } from './controlDefinition.js'
import type { Coordinate, Dimension } from './id.js'

export function generateButtonsGrid(
	width: number,
	height: number,
	pixelSize: Dimension,
	pixelOffset: Coordinate,
	pixelPadding: Coordinate,
	columnOffset = 0,
): StreamDeckButtonControlDefinition[] {
	const controls: StreamDeckButtonControlDefinition[] = []

	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			const index = row * width + column
			const hidIndex = index + 1

			controls.push({
				type: 'button',
				row,
				column: column + columnOffset,
				index,
				hidId: hidIndex,
				feedbackType: 'lcd',
				pixelSize,
				pixelPosition: {
					// TODO - refine these?
					x: pixelOffset.x + column * (pixelSize.width + pixelPadding.x),
					y: pixelOffset.y + row * (pixelSize.height + pixelPadding.y),
				},
			})
		}
	}

	return controls
}

export function freezeDefinitions(controls: StreamDeckControlDefinition[]): Readonly<StreamDeckControlDefinition[]> {
	return Object.freeze(controls.map((control) => Object.freeze(control)))
}
