import type { Coordinate, Dimension } from '../../id.js'

export interface MXConsoleImageWriterProps {
	pixelSize: Dimension
	pixelPosition: Coordinate
}

export interface MXConsoleImageWriter<TProps = MXConsoleImageWriterProps> {
	/** The largest image, in bytes, which can be written */
	readonly maxImageByteLength: number

	generateFillImageWrites(props: TProps, byteBuffer: Uint8Array): Uint8Array[]

	/** Interpret the device's answer to one of the writes */
	parseWriteAnswer(answer: Uint8Array): ImageWriteStatus
}

/**
 * - `accepted` - the write was accepted, though for an image of multiple writes it is only drawn once the last is accepted
 * - `busy` - the device has too many images still to draw, so the whole image must be sent again later
 */
export type ImageWriteStatus = 'accepted' | 'busy'
