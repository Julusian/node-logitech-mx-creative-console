import type { ButtonLcdImagePacker, InternalFillImageOptions } from './interface.js'
import { transformImageBuffer } from '../../util.js'
import type { EncodeJPEGHelper } from '../../models/base.js'
import type { Dimension } from '../../id.js'

/**
 * The qualities to try in turn, when encoding at the default quality produces an image too large for the device
 */
const FALLBACK_QUALITIES = [80, 65, 50, 35, 20]

export class JpegButtonLcdImagePacker implements ButtonLcdImagePacker {
	readonly #encodeJPEG: EncodeJPEGHelper

	constructor(encodeJPEG: EncodeJPEGHelper) {
		this.#encodeJPEG = encodeJPEG
	}

	public async convertPixelBuffer(
		sourceBuffer: Uint8Array,
		sourceOptions: InternalFillImageOptions,
		targetSize: Dimension,
		maxByteLength: number,
	): Promise<Uint8Array | null> {
		const byteBuffer = transformImageBuffer(
			sourceBuffer,
			sourceOptions,
			{ colorMode: 'rgba' },
			0,
			targetSize.width,
			targetSize.height,
		)

		const encoded = await this.#encodeJPEG(byteBuffer, targetSize.width, targetSize.height)
		if (encoded.length <= maxByteLength) return encoded

		for (const quality of FALLBACK_QUALITIES) {
			const reencoded = await this.#encodeJPEG(byteBuffer, targetSize.width, targetSize.height, { quality })
			if (reencoded.length <= maxByteLength) return reencoded
		}

		return null
	}
}
