import type { HIDDevice } from '../hid-device.js'
import type { OpenMXConsoleOptions, MXConsoleProperties } from './base.js'
import { MXConsoleBase } from './base.js'
import { DeviceModelId, MODEL_NAMES } from '../id.js'
import { freezeDefinitions } from '../controlsGenerator.js'
import { CallbackHook } from '../services/callback-hook.js'
import type { MXCreativeConsoleEvents } from '../types.js'
import {
	DialpadInputService,
	DIALPAD_DIAL_FEATURE_INDEX,
	DIALPAD_REPROG_CONTROLS_FEATURE_INDEX,
} from '../services/input/mx-creative-dialpad.js'

/**
 * The dials, as the items of the dial feature which they report their rotation as.
 * The small dial finishes the top row, with the large dial in the middle of the row below.
 */
const DIAL_CONTROLS = [
	/** Reports its rotation the opposite way round to the large dial */
	{ hidIndex: 0, row: 0, column: 2, invertRotation: true },
	{ hidIndex: 1, row: 1, column: 1, invertRotation: false },
]

/** The buttons, filling the places the dials leave in the two rows */
const BUTTON_CONTROLS = [
	{ hidId: 0x0053, row: 0, column: 0 },
	{ hidId: 0x0056, row: 0, column: 1 },
	{ hidId: 0x0059, row: 1, column: 0 },
	{ hidId: 0x005a, row: 1, column: 2 },
]

/** The dials which count up when turned the way the other counts down */
const INVERTED_DIAL_HID_INDEXES = new Set(
	DIAL_CONTROLS.filter((dial) => dial.invertRotation).map((dial) => dial.hidIndex),
)

const dialpadProperties: MXConsoleProperties = {
	MODEL: DeviceModelId.MX_CREATIVE_DIALPAD,
	PRODUCT_NAME: MODEL_NAMES[DeviceModelId.MX_CREATIVE_DIALPAD],

	CONTROLS: freezeDefinitions([
		...DIAL_CONTROLS.map((dial, index) => ({
			type: 'encoder' as const,
			row: dial.row,
			column: dial.column,
			index,
			hidIndex: dial.hidIndex,
			hasLed: false,
			ledRingSteps: 0,
		})),
		...BUTTON_CONTROLS.map((button, index) => ({
			type: 'button' as const,
			row: button.row,
			column: button.column,
			index,
			hidId: button.hidId,
			feedbackType: 'none' as const,
		})),
	]),
}

export function mxCreativeDialpadFactory(device: HIDDevice, options: Required<OpenMXConsoleOptions>): MXConsoleBase {
	const events = new CallbackHook<MXCreativeConsoleEvents>()

	// The dialpad has no display, and nothing to configure
	return new MXConsoleBase(device, options, {
		deviceProperties: dialpadProperties,
		events,
		inputService: new DialpadInputService(dialpadProperties, events, INVERTED_DIAL_HID_INDEXES),
	})
}

/** A HID++ request: report id, device, feature index, (function << 4) | software id, then parameters */
function hidppRequest(featureIndex: number, functionId: number, params: number[]): Uint8Array {
	const request = new Uint8Array(20)
	request.set([0x11, 0xff, featureIndex, (functionId << 4) | 0x0b, ...params])
	return request
}

const SET_REPORTING_FUNCTION_ID = 3
/** Report the button to the software instead of it acting as a normal HID button */
const DIVERT_TO_SOFTWARE = 0x03
const ENABLE_REPORTING = 0x01

export const mxCreativeDialpadInitWrites: Uint8Array[] = [
	...BUTTON_CONTROLS.map((button) =>
		hidppRequest(DIALPAD_REPROG_CONTROLS_FEATURE_INDEX, SET_REPORTING_FUNCTION_ID, [
			button.hidId >> 8,
			button.hidId & 0xff,
			DIVERT_TO_SOFTWARE,
		]),
	),

	// The dials report nothing at all until their rotation is enabled
	...DIAL_CONTROLS.map((dial) =>
		hidppRequest(DIALPAD_DIAL_FEATURE_INDEX, SET_REPORTING_FUNCTION_ID, [dial.hidIndex, ENABLE_REPORTING]),
	),
]
