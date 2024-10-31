export type KeyIndex = number

export type EncoderIndex = number

export type Dimension = { width: number; height: number }

export type Coordinate = { x: number; y: number }

export enum DeviceModelId {
	MX_CREATIVE_KEYPAD = 'mx-creative-keypad',
}

export const MODEL_NAMES: { [key in DeviceModelId]: string } = {
	[DeviceModelId.MX_CREATIVE_KEYPAD]: 'MX Creative Keypad',
}
