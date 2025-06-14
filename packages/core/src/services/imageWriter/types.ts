import type { Coordinate, Dimension } from '../../id.js'

export interface MXConsoleImageWriterProps {
	pixelSize: Dimension
	pixelPosition: Coordinate
}

export interface MXConsoleImageWriter<TProps = MXConsoleImageWriterProps> {
	generateFillImageWrites(props: TProps, byteBuffer: Uint8Array): Uint8Array[]
}
