import jpegTurbo from '@julusian/jpeg-turbo'
import { uint8ArrayToBuffer } from './util.js'

export interface JPEGEncodeOptions {
	quality: number
	subsampling?: number
}

const DEFAULT_QUALITY = 95

/**
 * The default JPEG encoder.
 * `@julusian/jpeg-turbo` will be used if it can be found, otherwise it will fall back to `jpeg-js`
 * @param buffer The buffer to convert
 * @param width Width of the image
 * @param height Height of the image
 */
export async function encodeJPEG(
	buffer: Uint8Array,
	width: number,
	height: number,
	options: JPEGEncodeOptions | undefined,
): Promise<Uint8Array> {
	if (buffer.length < width * height * 4) {
		throw new Error(
			`Buffer length (${buffer.length}) is too small for the specified width (${width}) and height (${height}). Expected at least ${width * height * 4} bytes.`,
		)
	}

	const encodeOptions: jpegTurbo.EncodeOptions = {
		format: jpegTurbo.FORMAT_RGBA,
		width,
		height,
		quality: DEFAULT_QUALITY,
		...options,
	}

	const tmpBuffer = Buffer.alloc(jpegTurbo.bufferSize(encodeOptions))
	return jpegTurbo.compress(uint8ArrayToBuffer(buffer), tmpBuffer, encodeOptions) // Future: avoid rewrap
}
