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
 * An opened HID collection of a console, and the report ids it carries.
 * An empty set of report ids means the handle is the device as a whole.
 */
export interface NodeHIDCollection {
	handle: HIDAsync
	reportIds: ReadonlySet<number>
}

/**
 * The wrapped node-hid HIDDevice.
 * This translates it into the common format expected by @logitech-mx-creative-console/core
 */
export class NodeHIDDevice extends EventEmitter<HIDDeviceEvents> implements HIDDevice {
	readonly #collections: readonly NodeHIDCollection[]
	readonly #writeQueue = new PQueue({ concurrency: 1 })

	constructor(collections: NodeHIDCollection[]) {
		super()

		this.#collections = collections

		for (const { handle } of collections) {
			let receivedInput = false

			handle.on('data', (data: Buffer) => {
				receivedInput = true
				this.emit('input', data[0], data.subarray(1))
			})

			handle.on('error', (error) => {
				// Some collections are write only, such as the one images are sent to, and their read
				// loop fails as soon as it is started. That is not a device failure, so don't report it.
				if (receivedInput || collections.length === 1) this.emit('error', error)
			})
		}
	}

	/**
	 * Windows splits a device into one handle per collection, each rejecting reports which belong to
	 * another, so a report has to be written to the handle owning it. Elsewhere the device is a
	 * single handle taking every report, which no collection claims and so falls through to here.
	 */
	#handleForReport(reportId: number): HIDAsync {
		const collection = this.#collections.find((collection) => collection.reportIds.has(reportId))
		return (collection ?? this.#collections[0]).handle
	}

	public async close(): Promise<void> {
		await Promise.all(this.#collections.map(async ({ handle }) => handle.close()))
	}

	public async sendFeatureReport(data: Uint8Array): Promise<void> {
		await this.#handleForReport(data[0]).sendFeatureReport(uint8ArrayToBuffer(data)) // Future: avoid re-wrap
	}
	public async getFeatureReport(reportId: number, reportLength: number): Promise<Uint8Array> {
		return this.#handleForReport(reportId).getFeatureReport(reportId, reportLength)
	}
	public async sendReports(buffers: Uint8Array[]): Promise<void> {
		await this.#writeQueue.add(async () => {
			for (const data of buffers) {
				await this.#handleForReport(data[0]).write(uint8ArrayToBuffer(data)) // Future: avoid re-wrap
			}

			// Small delay to prevent overwhelming the device with back-to-back reports, which can cause it to skip some draws
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
	}

	public async getDeviceInfo(): Promise<HIDDeviceInfo> {
		const info: NodeHIDDeviceInfo = await this.#collections[0].handle.getDeviceInfo()

		return { path: info.path, productId: info.productId, vendorId: info.vendorId, serialNumber: info.serialNumber }
	}
}
