import type { HIDDevice } from '../hid-device.js'
import type { HidppTransport } from '../hidpp.js'
import { createDivertControlRequest, createHidppRequest } from '../hidpp.js'
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

/** The function of the dial feature which sets how a dial is reported */
const DIAL_SET_REPORTING_FUNCTION_ID = 3
const DIAL_ENABLE_REPORTING = 0x01

export function mxCreativeDialpadInitWrites(controls: Readonly<MXConsoleControlDefinition[]>): Uint8Array[] {
	return [
		...controls
			.filter((control) => control.type === 'button')
			.map((button) => createDivertControlRequest(DIALPAD_REPROG_CONTROLS_FEATURE_INDEX, button.hidIndex)),

		// The dials report nothing at all until their rotation is enabled
		...controls
			.filter((control) => control.type === 'encoder')
			.map((dial) =>
				createHidppRequest(DIALPAD_DIAL_FEATURE_INDEX, DIAL_SET_REPORTING_FUNCTION_ID, [
					dial.hidIndex,
					DIAL_ENABLE_REPORTING,
				]),
			),
	]
}
