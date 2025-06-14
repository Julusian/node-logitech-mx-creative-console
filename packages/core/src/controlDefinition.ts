import type { Coordinate, Dimension } from './id.js'

export interface MXConsoleControlDefinitionBase {
	type: 'button'

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

export type MXConsoleControlDefinition = MXConsoleButtonControlDefinition
