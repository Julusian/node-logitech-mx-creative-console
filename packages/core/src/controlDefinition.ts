import type { Dimension } from './id.js'

/**
 * A rectangle on the face of a device, with the origin at its top left and `y` increasing downwards.
 * Distances are in the units of `MXConsoleModelInfo.faceSize`; for models with a panel those are panel
 * pixels, so these bounds are also the region the control occupies in an image filling the panel.
 */
export interface MXConsoleControlBounds {
	x: number
	y: number
	width: number
	height: number
}

export interface MXConsoleControlDefinitionBase {
	id: string
	type: 'button' | 'encoder'

	row: number
	column: number

	/** Where this control sits on the face, within `MXConsoleModelInfo.faceSize` */
	bounds: MXConsoleControlBounds
}

export interface MXConsoleButtonControlDefinitionBase extends MXConsoleControlDefinitionBase {
	type: 'button'

	index: number
	/** @internal on wire HID index of this button */
	hidIndex: number

	feedbackType: 'none' | 'lcd'
}
export interface MXConsoleButtonControlDefinitionNoFeedback extends MXConsoleButtonControlDefinitionBase {
	feedbackType: 'none'
}

export interface MXConsoleButtonControlDefinitionLcdFeedback extends MXConsoleButtonControlDefinitionBase {
	feedbackType: 'lcd'

	pixelSize: Dimension
}

export type MXConsoleButtonControlDefinition =
	MXConsoleButtonControlDefinitionNoFeedback | MXConsoleButtonControlDefinitionLcdFeedback

export interface MXConsoleEncoderControlDefinition extends MXConsoleControlDefinitionBase {
	type: 'encoder'

	index: number
	/** @internal on wire HID index of this encoder */
	hidIndex: number

	/** Whether the encoder has an led */
	hasLed: boolean

	/** The number of steps in encoder led rings (if any) */
	ledRingSteps: number
}

export type MXConsoleControlDefinition = MXConsoleButtonControlDefinition | MXConsoleEncoderControlDefinition
