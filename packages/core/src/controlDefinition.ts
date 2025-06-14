import type { Coordinate, Dimension } from './id.js'

export interface MXConsoleControlDefinitionBase {
	type: 'button' | 'encoder'

	row: number
	column: number
}

export interface MXConsoleButtonControlDefinitionBase extends MXConsoleControlDefinitionBase {
	type: 'button'

	index: number
	hidId: number

	feedbackType: 'none' | 'lcd'
}
export interface MXConsoleButtonControlDefinitionNoFeedback extends MXConsoleButtonControlDefinitionBase {
	feedbackType: 'none'
}

export interface MXConsoleButtonControlDefinitionLcdFeedback extends MXConsoleButtonControlDefinitionBase {
	feedbackType: 'lcd'

	pixelSize: Dimension
	pixelPosition: Coordinate
}

export type MXConsoleButtonControlDefinition =
	| MXConsoleButtonControlDefinitionNoFeedback
	| MXConsoleButtonControlDefinitionLcdFeedback

export interface MXConsoleEncoderControlDefinition extends MXConsoleControlDefinitionBase {
	type: 'encoder'

	index: number
	hidIndex: number

	/** Whether the encoder has an led */
	hasLed: boolean

	/** The number of steps in encoder led rings (if any) */
	ledRingSteps: number
}

export type MXConsoleControlDefinition = MXConsoleButtonControlDefinition | MXConsoleEncoderControlDefinition
