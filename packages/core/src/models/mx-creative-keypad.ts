import type { HIDDevice } from '../hid-device.js'
import type { OpenStreamDeckOptions, StreamDeckProperties } from './base.js'
import { StreamDeckBase } from './base.js'
import { DeviceModelId, MODEL_NAMES } from '../id.js'
import { freezeDefinitions, generateButtonsGrid } from '../controlsGenerator.js'
import { CallbackHook } from '../services/callback-hook.js'
import type { MXCreativeConsoleEvents } from '../types.js'
import { DefaultButtonsLcdService } from '../services/buttonsLcdDisplay/default.js'
import { JpegButtonLcdImagePacker } from '../services/imagePacker/jpeg.js'
import { StreamdeckDefaultImageWriter } from '../services/imageWriter/imageWriter.js'
import { KeypadInputService } from '../services/input/mx-creative-keypad.js'
import { Gen2PropertiesService } from '../services/properties/gen2.js'

const keypadProperties: StreamDeckProperties = {
	MODEL: DeviceModelId.MX_CREATIVE_KEYPAD,
	PRODUCT_NAME: MODEL_NAMES[DeviceModelId.MX_CREATIVE_KEYPAD],

	CONTROLS: freezeDefinitions(
		generateButtonsGrid(3, 3, { width: 118, height: 118 }, { x: 23, y: 6 }, { x: 40, y: 40 }),
	),

	PANEL_SIZE: { width: 480, height: 480 },
}

export function mxCreativeKeypadFactory(device: HIDDevice, options: Required<OpenStreamDeckOptions>): StreamDeckBase {
	const events = new CallbackHook<MXCreativeConsoleEvents>()

	return new StreamDeckBase(device, options, {
		deviceProperties: keypadProperties,
		events,
		properties: new Gen2PropertiesService(device),
		buttonsLcd: new DefaultButtonsLcdService(
			new StreamdeckDefaultImageWriter(),
			new JpegButtonLcdImagePacker(options.encodeJPEG),
			device,
			keypadProperties,
		),
		inputService: new KeypadInputService(keypadProperties, events),
	})
}
