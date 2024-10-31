import type { Coordinate, Dimension } from './id.js'

export interface StreamDeckControlDefinitionBase {
	type: 'button' | 'encoder' | 'lcd-segment'

	row: number
	column: number
}

export interface StreamDeckButtonControlDefinitionBase extends StreamDeckControlDefinitionBase {
	type: 'button'

	index: number
	hidId: number

	feedbackType: 'none' | 'lcd'
}
export interface StreamDeckButtonControlDefinitionNoFeedback extends StreamDeckButtonControlDefinitionBase {
	feedbackType: 'none'
}

export interface StreamDeckButtonControlDefinitionLcdFeedback extends StreamDeckButtonControlDefinitionBase {
	feedbackType: 'lcd'

	pixelSize: Dimension
	pixelPosition: Coordinate
}

export type StreamDeckButtonControlDefinition =
	| StreamDeckButtonControlDefinitionNoFeedback
	| StreamDeckButtonControlDefinitionLcdFeedback

export interface StreamDeckEncoderControlDefinition extends StreamDeckControlDefinitionBase {
	type: 'encoder'

	index: number
	hidIndex: number

	/** Whether the encoder has an led */
	hasLed: boolean

	/** The number of steps in encoder led rings (if any) */
	ledRingSteps: number
}

export type StreamDeckControlDefinition = StreamDeckButtonControlDefinition | StreamDeckEncoderControlDefinition
