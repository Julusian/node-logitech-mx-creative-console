import type { HIDDevice } from '../hid-device.js'
import type { HidppTransport } from '../hidpp.js'
import type { OpenMXConsoleOptions } from './base.js'
import { MXConsoleBase } from './base.js'
import type { MXConsoleControlDefinition } from '../controlDefinition.js'
import type { MXConsoleModelDefinition } from '../modelInfo.js'
import { CallbackHook } from '../services/callback-hook.js'
import type { MXCreativeConsoleEvents } from '../types.js'
import {
	DialpadInputService,
	DIALPAD_DIAL_FEATURE_INDEX,
	DIALPAD_REPROG_CONTROLS_FEATURE_INDEX,
} from '../services/input/mx-creative-dialpad.js'

/** The small dial reports its rotation the opposite way round to the large dial */
const INVERTED_DIAL_HID_INDEXES: ReadonlySet<number> = new Set([0])

export function mxCreativeDialpadFactory(
	definition: MXConsoleModelDefinition,
	device: HIDDevice,
	transport: HidppTransport,
	options: Required<OpenMXConsoleOptions>,
): MXConsoleBase {
	const events = new CallbackHook<MXCreativeConsoleEvents>()

	// The dialpad has no display, and nothing to configure
	return new MXConsoleBase(device, transport, options, {
		modelInfo: definition.info,
		deviceProperties: definition.properties,
		events,
		inputService: new DialpadInputService(definition.properties, events, INVERTED_DIAL_HID_INDEXES),
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

export function mxCreativeDialpadInitWrites(controls: Readonly<MXConsoleControlDefinition[]>): Uint8Array[] {
	return [
		...controls
			.filter((control) => control.type === 'button')
			.map((button) =>
				hidppRequest(DIALPAD_REPROG_CONTROLS_FEATURE_INDEX, SET_REPORTING_FUNCTION_ID, [
					button.hidIndex >> 8,
					button.hidIndex & 0xff,
					DIVERT_TO_SOFTWARE,
				]),
			),

		// The dials report nothing at all until their rotation is enabled
		...controls
			.filter((control) => control.type === 'encoder')
			.map((dial) =>
				hidppRequest(DIALPAD_DIAL_FEATURE_INDEX, SET_REPORTING_FUNCTION_ID, [dial.hidIndex, ENABLE_REPORTING]),
			),
	]
}
