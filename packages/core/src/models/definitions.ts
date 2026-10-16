import type { MXConsoleControlDefinition } from '../controlDefinition.js'
import { freezeDefinitions, generateButtonsGrid } from '../controlsGenerator.js'
import type { MXConsoleStaticProperties } from './base.js'

/**
 * The static properties of each model.
 *
 * Note: this module must not import anything which pulls in the services used to drive a device,
 * so that `DEVICE_MODEL_INFO` can be consumed without them.
 */

/**
 * MX Creative Keypad, whose panel is 480x480, and the `bounds` are in panel pixels.
 * The two page buttons sit below the panel, making the face taller. No drawing is published, so their
 * geometry is ESTIMATED: each is under the outer button column on its side, as wide as that column,
 * and the gap above them matches the gap the panel leaves below its last row.
 */
const keypadPanelSize = { width: 480, height: 480 }
const keypadPageButtonGap = 40
const keypadPageButtonHeight = 40
const keypadPageButtonY = keypadPanelSize.height + keypadPageButtonGap
const keypadControls: MXConsoleControlDefinition[] = generateButtonsGrid(
	3,
	3,
	{ width: 118, height: 118 },
	{ x: 23, y: 6 },
	{ x: 40, y: 40 },
)
keypadControls.push(
	// There are only two buttons in this row, so the right one is column 1 despite being under column 2
	...[
		{ id: 'page-l', column: 0, index: 9, hidIndex: 0x01a1, buttonAbove: 'button-6' },
		{ id: 'page-r', column: 1, index: 10, hidIndex: 0x01a2, buttonAbove: 'button-8' },
	].map((button): MXConsoleControlDefinition => {
		const buttonAbove = keypadControls.find((control) => control.id === button.buttonAbove)
		if (!buttonAbove) throw new Error(`Missing bounds for ${button.buttonAbove}`)

		return {
			id: button.id,
			type: 'button',
			row: 3,
			column: button.column,
			index: button.index,
			hidIndex: button.hidIndex,
			hidId: button.hidIndex,
			feedbackType: 'none',

			bounds: {
				x: buttonAbove.bounds.x,
				y: keypadPageButtonY,
				width: buttonAbove.bounds.width,
				height: keypadPageButtonHeight,
			},
		}
	}),
)

export const keypadProperties: MXConsoleStaticProperties = {
	controls: freezeDefinitions(keypadControls),

	faceSize: { width: keypadPanelSize.width, height: keypadPageButtonY + keypadPageButtonHeight },
	panelSize: keypadPanelSize,

	supportsBrightness: true,
}

/**
 * MX Creative Dialpad. It has no panel and no drawing is published, so its geometry is ESTIMATED: every
 * control is given an equal cell of the grid made by the rows and columns, which keeps the arrangement
 * but not the sizes. The face is in arbitrary units.
 * The small dial finishes the top row, with the large dial in the middle of the row below.
 */
const dialpadCellSize = 100
const dialpadCellGap = 20
function dialpadCellBounds(row: number, column: number): MXConsoleControlDefinition['bounds'] {
	return {
		x: column * (dialpadCellSize + dialpadCellGap),
		y: row * (dialpadCellSize + dialpadCellGap),
		width: dialpadCellSize,
		height: dialpadCellSize,
	}
}

/** The dials, as the items of the dial feature which they report their rotation as */
const dialpadDials = [
	{ hidIndex: 0, row: 0, column: 2 },
	{ hidIndex: 1, row: 1, column: 1 },
]
/** The buttons, as the reprogrammable control ids they report as, filling the places the dials leave */
const dialpadButtons = [
	{ hidIndex: 0x0053, row: 0, column: 0 },
	{ hidIndex: 0x0056, row: 0, column: 1 },
	{ hidIndex: 0x0059, row: 1, column: 0 },
	{ hidIndex: 0x005a, row: 1, column: 2 },
]

export const dialpadProperties: MXConsoleStaticProperties = {
	controls: freezeDefinitions([
		...dialpadDials.map((dial, index): MXConsoleControlDefinition => ({
			id: `encoder-${index}`,
			type: 'encoder',
			row: dial.row,
			column: dial.column,
			index,
			hidIndex: dial.hidIndex,

			bounds: dialpadCellBounds(dial.row, dial.column),

			hasLed: false,
			ledRingSteps: 0,
		})),
		...dialpadButtons.map((button, index): MXConsoleControlDefinition => ({
			id: `button-${index}`,
			type: 'button',
			row: button.row,
			column: button.column,
			index,
			hidIndex: button.hidIndex,
			hidId: button.hidIndex,
			feedbackType: 'none',

			bounds: dialpadCellBounds(button.row, button.column),
		})),
	]),

	faceSize: {
		width: 3 * dialpadCellSize + 2 * dialpadCellGap,
		height: 2 * dialpadCellSize + dialpadCellGap,
	},
	panelSize: null,

	supportsBrightness: false,
}
