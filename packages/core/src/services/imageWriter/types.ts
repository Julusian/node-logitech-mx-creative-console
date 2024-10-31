import type { Coordinate, Dimension } from '../../id.js'

export interface StreamdeckImageWriterProps {
	pixelSize: Dimension
	pixelPosition: Coordinate
}

export interface StreamdeckImageWriter<TProps = StreamdeckImageWriterProps> {
	generateFillImageWrites(props: TProps, byteBuffer: Uint8Array): Uint8Array[]
}
