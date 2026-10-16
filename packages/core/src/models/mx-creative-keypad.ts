import type { HIDDevice } from '../hid-device.js'
import type { HidppTransport } from '../hidpp.js'
import { createDivertControlRequest } from '../hidpp.js'
import type { MXConsoleControlDefinition } from '../controlDefinition.js'
import type { OpenMXConsoleOptions, MXConsolePanelProperties } from './base.js'
import { MXConsoleBase } from './base.js'
import type { MXConsoleModelDefinition } from '../modelInfo.js'
import { CallbackHook } from '../services/callback-hook.js'
import type { MXCreativeConsoleEvents } from '../types.js'
import { DefaultButtonsLcdService } from '../services/buttonsLcdDisplay/default.js'
import { JpegButtonLcdImagePacker } from '../services/imagePacker/jpeg.js'
import { MXConsoleDefaultImageWriter } from '../services/imageWriter/imageWriter.js'
import { KeypadInputService, KEYPAD_REPROG_CONTROLS_FEATURE_INDEX } from '../services/input/mx-creative-keypad.js'
import { DefaultPropertiesService } from '../services/properties/default.js'

export function mxCreativeKeypadFactory(
	definition: MXConsoleModelDefinition,
	device: HIDDevice,
	transport: HidppTransport,
	options: Required<OpenMXConsoleOptions>,
): MXConsoleBase {
	const { panelSize } = definition.properties
	if (!panelSize) throw new Error(`${definition.info.name} is expected to have a display`)
	const properties: MXConsolePanelProperties = { ...definition.properties, panelSize }

	const events = new CallbackHook<MXCreativeConsoleEvents>()

	return new MXConsoleBase(device, transport, options, {
		modelInfo: definition.info,
		deviceProperties: properties,
		events,
		properties: new DefaultPropertiesService(device, transport),
		buttonsLcd: new DefaultButtonsLcdService(
			new MXConsoleDefaultImageWriter(),
			new JpegButtonLcdImagePacker(options.encodeJPEG),
			transport,
			properties,
		),
		inputService: new KeypadInputService(properties, events),
	})
}

/** The buttons outside the panel are only reported once diverted to the software */
export function mxCreativeKeypadInitWrites(controls: Readonly<MXConsoleControlDefinition[]>): Uint8Array[] {
	return controls
		.filter((control) => control.type === 'button' && control.feedbackType === 'none')
		.map((button) => createDivertControlRequest(KEYPAD_REPROG_CONTROLS_FEATURE_INDEX, button.hidIndex))
}
