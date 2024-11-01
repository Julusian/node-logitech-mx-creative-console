import type { EventEmitter } from 'eventemitter3'

export interface HIDDeviceEvents {
	error: [data: any]
	input: [reportId: number, payload: Uint8Array]
}

/**
 * The expected interface for a HIDDevice.
 * This is to be implemented by any wrapping libraries to translate their platform specific devices into a common and simpler form
 */
export interface HIDDevice extends EventEmitter<HIDDeviceEvents> {
	close(): Promise<void>

	sendFeatureReport(data: Uint8Array): Promise<void>
	getFeatureReport(reportId: number, reportLength: number): Promise<Uint8Array>

	sendReports(buffers: Uint8Array[]): Promise<void>

	getDeviceInfo(): Promise<HIDDeviceInfo>
}

export interface HIDDeviceInfo {
	readonly path: string | undefined
	readonly productId: number
	readonly vendorId: number
	readonly serialNumber: string | undefined
}
