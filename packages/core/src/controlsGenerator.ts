import type { MXConsoleButtonControlDefinition, MXConsoleControlDefinition } from './controlDefinition.js'
import type { Coordinate, Dimension } from './id.js'

export function generateButtonsGrid(
	width: number,
	height: number,
	pixelSize: Dimension,
	pixelOffset: Coordinate,
	pixelPadding: Coordinate,
	columnOffset = 0,
): MXConsoleButtonControlDefinition[] {
	const controls: MXConsoleButtonControlDefinition[] = []

	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			const index = row * width + column
			const hidIndex = index + 1

			controls.push({
				id: `button-${index}`,
				type: 'button',
				row,
				column: column + columnOffset,
				index,
				hidIndex,
				feedbackType: 'lcd',
				pixelSize,

				bounds: {
					x: pixelOffset.x + column * (pixelSize.width + pixelPadding.x),
					y: pixelOffset.y + row * (pixelSize.height + pixelPadding.y),
					...pixelSize,
				},
			})
		}
	}

	return controls
}

export function freezeDefinitions(controls: MXConsoleControlDefinition[]): Readonly<MXConsoleControlDefinition[]> {
	// Consumers persist the ids, so a duplicate would make two controls indistinguishable
	const seenIds = new Set<string>()
	for (const control of controls) {
		const id = `${control.type}:${control.id}`
		if (seenIds.has(id)) {
			throw new Error(`Duplicate control id "${id}"`)
		}
		seenIds.add(id)
	}

	return Object.freeze(
		controls.map((control) => {
			Object.freeze(control.bounds)
			if (control.type === 'button' && control.feedbackType === 'lcd') {
				Object.freeze(control.pixelSize)
			}
			return Object.freeze(control)
		}),
	)
}
