export type KeyIndex = number

export type EncoderIndex = number

export type Dimension = { width: number; height: number }

export type Coordinate = { x: number; y: number }

export enum DeviceModelId {
	MX_CREATIVE_KEYPAD = 'mx-creative-keypad',
	// MX_CREATIVE_DIALPAD = 'mx-creative-dialpad',
}

export const MODEL_NAMES: { [key in DeviceModelId]: string } = {
	[DeviceModelId.MX_CREATIVE_KEYPAD]: 'MX Creative Keypad',
	// [DeviceModelId.MX_CREATIVE_DIALPAD]: 'MX Creative Dialpad',
}
