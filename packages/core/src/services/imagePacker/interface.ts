import type { Dimension } from '../../id.js'
import type { FillImageOptions } from '../../types.js'

export interface InternalFillImageOptions extends FillImageOptions {
	offset: number
	stride: number
}

export interface ButtonLcdImagePacker {
	/**
	 * Convert a pixel buffer into the bytes to send to the device
	 * @param maxByteLength The largest result the device will accept
	 * @returns The packed image, or null if it could not be made small enough
	 */
	convertPixelBuffer(
		sourceBuffer: Uint8Array,
		sourceOptions: InternalFillImageOptions,
		targetSize: Dimension,
		maxByteLength: number,
	): Promise<Uint8Array | null>
}
