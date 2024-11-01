import type { InternalFillImageOptions } from './services/imagePacker/interface.js'

export interface FillImageTargetOptions {
	colorMode: 'bgr' | 'rgba'
	xFlip?: boolean
	yFlip?: boolean
	rotate?: boolean
}

export function transformImageBuffer(
	imageBuffer: Uint8Array | Uint8ClampedArray,
	sourceOptions: InternalFillImageOptions,
	targetOptions: FillImageTargetOptions,
	destPadding: number,
	imageWidth: number,
	imageHeight: number,
): Uint8Array {
	const imageBufferView = uint8ArrayToDataView(imageBuffer)

	const byteBuffer = new Uint8Array(destPadding + imageWidth * imageHeight * targetOptions.colorMode.length)
	const byteBufferView = uint8ArrayToDataView(byteBuffer)

	const flipColours = sourceOptions.format.substring(0, 3) !== targetOptions.colorMode.substring(0, 3)

	for (let y = 0; y < imageHeight; y++) {
		const rowOffset = destPadding + imageWidth * targetOptions.colorMode.length * y
		for (let x = 0; x < imageWidth; x++) {
			// Apply x/y flips
			let x2 = targetOptions.xFlip ? imageWidth - x - 1 : x
			let y2 = targetOptions.yFlip ? imageHeight - y - 1 : y

			if (targetOptions.rotate) {
				// Swap x and y
				const tmpX = x2
				x2 = y2
				y2 = tmpX
			}

			const srcOffset = y2 * sourceOptions.stride + sourceOptions.offset + x2 * sourceOptions.format.length

			const red = imageBufferView.getUint8(srcOffset)
			const green = imageBufferView.getUint8(srcOffset + 1)
			const blue = imageBufferView.getUint8(srcOffset + 2)

			const targetOffset = rowOffset + x * targetOptions.colorMode.length
			if (flipColours) {
				byteBufferView.setUint8(targetOffset, blue)
				byteBufferView.setUint8(targetOffset + 1, green)
				byteBufferView.setUint8(targetOffset + 2, red)
			} else {
				byteBufferView.setUint8(targetOffset, red)
				byteBufferView.setUint8(targetOffset + 1, green)
				byteBufferView.setUint8(targetOffset + 2, blue)
			}
			if (targetOptions.colorMode.length === 4) {
				byteBufferView.setUint8(targetOffset + 3, 255)
			}
		}
	}

	return byteBuffer
}

export function uint8ArrayToDataView(buffer: Uint8Array | Uint8ClampedArray): DataView {
	return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}
