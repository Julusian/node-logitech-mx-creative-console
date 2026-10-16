import type { MXConsoleControlDefinition } from '../controlDefinition.js'
import { freezeDefinitions, generateButtonsGrid } from '../controlsGenerator.js'
import type { MXConsoleStaticProperties } from './base.js'

/**
 * The static properties of each model.
 *
 * Note: this module must not import anything which pulls in the services used to drive a device,
 * so that `DEVICE_MODELS` can be consumed without them.
 */

/**
 * Geometry is measured from Logitech's top-down product photo of both devices (mx-creative-console-top-view),
 * as no drawing is published. Both devices are in the one photo, so both faces use the same units: the
 * keypad's panel pixels, at 158 panel pixels per 213 photo pixels (the pitch of the keypad buttons).
 */

/**
 * MX Creative Keypad, whose panel is 480x480, and the `bounds` are in panel pixels.
 * The two page buttons sit below the panel, making the face taller. They are under the left and middle
 * columns, with the logo under the right, and the gap above them is the same as the gap between rows.
 * As with the panel buttons, their bounds are inset from the edge of the key cap.
 */
const keypadPanelSize = { width: 480, height: 480 }
const keypadButtonGap = 40
/** The panel buttons are 118 of their 187 photo pixel caps, and the page buttons are 123 tall */
const keypadPageButtonHeight = 70
const keypadControls: MXConsoleControlDefinition[] = generateButtonsGrid(
	3,
	3,
	{ width: 118, height: 118 },
	{ x: 23, y: 6 },
	{ x: keypadButtonGap, y: keypadButtonGap },
)
const keypadLastRowBottom = Math.max(...keypadControls.map((control) => control.bounds.y + control.bounds.height))
const keypadPageButtonY = keypadLastRowBottom + keypadButtonGap
keypadControls.push(
	...[
		{ id: 'page-l', column: 0, index: 9, hidIndex: 0x01a1, buttonAbove: 'button-6' },
		{ id: 'page-r', column: 1, index: 10, hidIndex: 0x01a2, buttonAbove: 'button-7' },
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
 * MX Creative Dialpad. It has no panel, so the face is the top of the whole device, in the same units as
 * the keypad. The buttons are round, and the small dial is a roller, so its bounds are wider than tall.
 * The small dial finishes the top row, with the large dial in the middle of the row below.
 */
const dialpadButtonSize = 116

/** The dials, as the items of the dial feature which they report their rotation as */
const dialpadDials = [
	{ hidIndex: 0, row: 0, column: 2, bounds: { x: 468, y: 59, width: 185, height: 100 } },
	{ hidIndex: 1, row: 1, column: 1, bounds: { x: 164, y: 220, width: 400, height: 400 } },
]
/** The buttons, as the reprogrammable control ids they report as, filling the places the dials leave */
const dialpadButtons = [
	{ hidIndex: 0x0053, row: 0, column: 0, x: 48, y: 50 },
	{ hidIndex: 0x0056, row: 0, column: 1, x: 182, y: 50 },
	{ hidIndex: 0x0059, row: 1, column: 0, x: 48, y: 556 },
	{ hidIndex: 0x005a, row: 1, column: 2, x: 571, y: 556 },
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

			bounds: { ...dial.bounds },

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
			feedbackType: 'none',

			bounds: { x: button.x, y: button.y, width: dialpadButtonSize, height: dialpadButtonSize },
		})),
	]),

	faceSize: { width: 744, height: 734 },
	panelSize: null,

	supportsBrightness: false,
}
