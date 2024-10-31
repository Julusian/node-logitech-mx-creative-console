import type { HIDDevice } from '../hid-device.js'
import type { OpenStreamDeckOptions, StreamDeckProperties } from './base.js'
import { StreamDeckBase } from './base.js'
import { DeviceModelId, MODEL_NAMES } from '../id.js'
import { freezeDefinitions, generateButtonsGrid } from '../controlsGenerator.js'
import { CallbackHook } from '../services/callback-hook.js'
import type { MXCreativeConsoleEvents } from '../types.js'
import { DefaultButtonsLcdService } from '../services/buttonsLcdDisplay/default.js'
import { JpegButtonLcdImagePacker } from '../services/imagePacker/jpeg.js'
import { StreamdeckGen2ImageHeaderGenerator } from '../services/imageWriter/headerGenerator.js'
import { StreamdeckDefaultImageWriter } from '../services/imageWriter/imageWriter.js'
import { Gen2InputService } from '../services/input/gen2.js'
import { Gen2PropertiesService } from '../services/properties/gen2.js'

const keypadProperties: StreamDeckProperties = {
	MODEL: DeviceModelId.MX_CREATIVE_KEYPAD,
	PRODUCT_NAME: MODEL_NAMES[DeviceModelId.MX_CREATIVE_KEYPAD],
	SUPPORTS_RGB_KEY_FILL: false, // rev2 doesn't support it, even though rev1 does

	CONTROLS: freezeDefinitions(generateButtonsGrid(8, 4, { width: 96, height: 96 })),

	KEY_SPACING_HORIZONTAL: 32,
	KEY_SPACING_VERTICAL: 39,

	FULLSCREEN_PANELS: 0,

	KEY_DATA_OFFSET: 3,
}

export function mxCreativeKeypadFactory(device: HIDDevice, options: Required<OpenStreamDeckOptions>): StreamDeckBase {
	const events = new CallbackHook<MXCreativeConsoleEvents>()

	return new StreamDeckBase(device, options, {
		deviceProperties: keypadProperties,
		events,
		properties: new Gen2PropertiesService(device),
		buttonsLcd: new DefaultButtonsLcdService(
			new StreamdeckDefaultImageWriter(new StreamdeckGen2ImageHeaderGenerator()),
			new JpegButtonLcdImagePacker(options.encodeJPEG, true),
			device,
			keypadProperties,
		),
		inputService: new Gen2InputService(keypadProperties, events),
	})
}
