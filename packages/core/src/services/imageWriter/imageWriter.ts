import { uint8ArrayToDataView } from '../../util.js'
import type { ImageWriteStatus, MXConsoleImageWriter, MXConsoleImageWriterProps } from './types.js'

export class MXConsoleDefaultImageWriter implements MXConsoleImageWriter<MXConsoleImageWriterProps> {
	// The length is sent as a uint16
	public readonly maxImageByteLength = 0xffff

	public generateFillImageWrites(props: MXConsoleImageWriterProps, byteBuffer: Uint8Array): Uint8Array[] {
		if (byteBuffer.length > this.maxImageByteLength) {
			throw new RangeError(
				`Image of ${byteBuffer.length} bytes exceeds the maximum of ${this.maxImageByteLength} bytes`,
			)
		}

		const MAX_PACKET_SIZE = 4095

		const result: Uint8Array[] = []

		// First packet is a little different
		const PACKET1_HEADER_LENGTH = 20
		const packet1 = new Uint8Array(MAX_PACKET_SIZE)
		const byteCount1 = Math.min(byteBuffer.length, MAX_PACKET_SIZE - PACKET1_HEADER_LENGTH)
		packet1.set(byteBuffer.subarray(0, byteCount1), PACKET1_HEADER_LENGTH)
		const packet1View = uint8ArrayToDataView(packet1)
		packet1View.setUint8(0, 0x14)
		packet1View.setUint8(1, 0xff)
		packet1View.setUint8(2, 0x02)
		packet1View.setUint8(3, 0x2b)
		packet1View.setUint8(4, generateWritePacketByte(1, true, byteCount1 >= byteBuffer.length))
		packet1View.setUint16(5, 0x0100)
		packet1View.setUint16(7, 0x0100)
		packet1View.setUint16(9, props.pixelPosition.x)
		packet1View.setUint16(11, props.pixelPosition.y)
		packet1View.setUint16(13, props.pixelSize.width)
		packet1View.setUint16(15, props.pixelSize.height)
		packet1View.setUint16(18, byteBuffer.length)

		result.push(packet1)

		let remainingBytes = byteBuffer.length - byteCount1
		for (let part = 2; remainingBytes > 0; part++) {
			const packet = new Uint8Array(MAX_PACKET_SIZE)

			const byteCount = Math.min(remainingBytes, MAX_PACKET_SIZE - 5)
			const byteOffset = byteBuffer.length - remainingBytes
			remainingBytes -= byteCount
			packet.set(byteBuffer.subarray(byteOffset, byteOffset + byteCount), 5)

			const packetView = uint8ArrayToDataView(packet)
			packetView.setUint8(0, 0x14)
			packetView.setUint8(1, 0xff)
			packetView.setUint8(2, 0x02)
			packetView.setUint8(3, 0x2b)
			packetView.setUint8(4, generateWritePacketByte(part, false, remainingBytes === 0))

			result.push(packet)
		}

		return result
	}

	public parseWriteAnswer(answer: Uint8Array): ImageWriteStatus {
		// The answer is: device index, feature index, function/software id, the part of the image, then the status
		const status = answer[4]
		switch (status) {
			case IMAGE_WRITE_STATUS_OK:
				return 'accepted'
			case IMAGE_WRITE_STATUS_BUSY:
				return 'busy'
			default:
				throw new Error(`Image write failed with status 0x${status.toString(16).padStart(2, '0')}`)
		}
	}
}

const IMAGE_WRITE_STATUS_OK = 0x00
/** Reported for the last write of an image, when the device has too many images queued to accept it */
const IMAGE_WRITE_STATUS_BUSY = 0xfb

function generateWritePacketByte(index: number, isFirst: boolean, isLast: boolean): number {
	let value = index | 0b00100000

	if (isFirst) value |= 0b10000000
	if (isLast) value |= 0b01000000

	return value
}
