import type { DeviceModelId, HIDDevice, HIDDeviceEvents, HIDDeviceInfo } from '@logitech-mx-creative-console/core'
import { EventEmitter } from 'eventemitter3'
import type { HIDAsync, Device as NodeHIDDeviceInfo } from 'node-hid'
import PQueue from 'p-queue'
import { uint8ArrayToBuffer } from './util.js'

/**
 * Information about a found MXCreativeConsole
 */
export interface MXCreativeConsoleDeviceInfo {
	/** The model of the device */
	model: DeviceModelId
	/** The connected path of the device in the usb tree */
	path: string
	/** The serialNumber of the device. If set it can be used as a unique hardware identifier */
	serialNumber?: string
}

/**
 * The wrapped node-hid HIDDevice.
 * This translates it into the common format expected by @logitech-mx-creative-console/core
 */
export class NodeHIDDevice extends EventEmitter<HIDDeviceEvents> implements HIDDevice {
	private device: HIDAsync
	readonly #writeQueue = new PQueue({ concurrency: 1 })

	constructor(device: HIDAsync) {
		super()

		this.device = device
		this.device.on('error', (error) => this.emit('error', error))

		this.device.on('data', (data: Buffer) => {
			this.emit('input', data[0], data.subarray(1))
		})
	}

	public async close(): Promise<void> {
		await this.device.close()
	}

	public async sendFeatureReport(data: Uint8Array): Promise<void> {
		await this.device.sendFeatureReport(uint8ArrayToBuffer(data)) // Future: avoid re-wrap
	}
	public async getFeatureReport(reportId: number, reportLength: number): Promise<Uint8Array> {
		return this.device.getFeatureReport(reportId, reportLength)
	}
	public async sendReports(buffers: Uint8Array[]): Promise<void> {
		await this.#writeQueue.add(async () => {
			for (const data of buffers) {
				await this.device.write(uint8ArrayToBuffer(data)) // Future: avoid re-wrap
			}

			// Small delay to prevent overwhelming the device with back-to-back reports, which can cause it to skip some draws
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
	}

	public async getDeviceInfo(): Promise<HIDDeviceInfo> {
		const info: NodeHIDDeviceInfo = await this.device.getDeviceInfo()

		return { path: info.path, productId: info.productId, vendorId: info.vendorId, serialNumber: info.serialNumber }
	}
}
