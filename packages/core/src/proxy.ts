import type { DeviceModelId } from './id.js'
import type { MXCreativeConsole, MXCreativeConsoleEvents } from './types.js'
import type { MXConsoleControlDefinition } from './controlDefinition.js'

/**
 * A minimal proxy around a MXConsole instance.
 * This is intended to be used by libraries wrapping this that want to add more methods to the MXConsole
 */

export class MXCreativeConsoleProxy implements MXCreativeConsole {
	protected readonly device: MXCreativeConsole

	constructor(device: MXCreativeConsole) {
		this.device = device
	}

	public get CONTROLS(): Readonly<MXConsoleControlDefinition[]> {
		return this.device.CONTROLS
	}
	public get MODEL(): DeviceModelId {
		return this.device.MODEL
	}
	public get PRODUCT_NAME(): string {
		return this.device.PRODUCT_NAME
	}

	public calculateFillPanelDimensions(
		...args: Parameters<MXCreativeConsole['calculateFillPanelDimensions']>
	): ReturnType<MXCreativeConsole['calculateFillPanelDimensions']> {
		return this.device.calculateFillPanelDimensions(...args)
	}

	public async close(): Promise<void> {
		return this.device.close()
	}
	public async getHidDeviceInfo(
		...args: Parameters<MXCreativeConsole['getHidDeviceInfo']>
	): ReturnType<MXCreativeConsole['getHidDeviceInfo']> {
		return this.device.getHidDeviceInfo(...args)
	}
	public async fillKeyColor(
		...args: Parameters<MXCreativeConsole['fillKeyColor']>
	): ReturnType<MXCreativeConsole['fillKeyColor']> {
		return this.device.fillKeyColor(...args)
	}
	public async fillKeyBuffer(
		...args: Parameters<MXCreativeConsole['fillKeyBuffer']>
	): ReturnType<MXCreativeConsole['fillKeyBuffer']> {
		return this.device.fillKeyBuffer(...args)
	}
	public async fillPanelBuffer(
		...args: Parameters<MXCreativeConsole['fillPanelBuffer']>
	): ReturnType<MXCreativeConsole['fillPanelBuffer']> {
		return this.device.fillPanelBuffer(...args)
	}
	public async clearKey(
		...args: Parameters<MXCreativeConsole['clearKey']>
	): ReturnType<MXCreativeConsole['clearKey']> {
		return this.device.clearKey(...args)
	}
	public async clearPanel(
		...args: Parameters<MXCreativeConsole['clearPanel']>
	): ReturnType<MXCreativeConsole['clearPanel']> {
		return this.device.clearPanel(...args)
	}
	public async setBrightness(
		...args: Parameters<MXCreativeConsole['setBrightness']>
	): ReturnType<MXCreativeConsole['setBrightness']> {
		return this.device.setBrightness(...args)
	}
	public async resetToLogo(
		...args: Parameters<MXCreativeConsole['resetToLogo']>
	): ReturnType<MXCreativeConsole['resetToLogo']> {
		return this.device.resetToLogo(...args)
	}
	// public async getFirmwareVersion(): Promise<string> {
	// 	return this.device.getFirmwareVersion()
	// }
	// public async getSerialNumber(): Promise<string> {
	// 	return this.device.getSerialNumber()
	// }

	/**
	 * EventEmitter
	 */

	public eventNames(
		...args: Parameters<MXCreativeConsole['eventNames']>
	): ReturnType<MXCreativeConsole['eventNames']> {
		return this.device.eventNames(...args)
	}
	public listeners(...args: Parameters<MXCreativeConsole['listeners']>): ReturnType<MXCreativeConsole['listeners']> {
		return this.device.listeners(...args)
	}
	public listenerCount(
		...args: Parameters<MXCreativeConsole['listenerCount']>
	): ReturnType<MXCreativeConsole['listenerCount']> {
		return this.device.listenerCount(...args)
	}
	public emit<K extends keyof MXCreativeConsoleEvents>(eventName: K, ...args: MXCreativeConsoleEvents[K]): boolean {
		return this.device.emit(eventName, ...(args as any))
	}
	public on<K extends keyof MXCreativeConsoleEvents>(
		eventName: K,
		listener: (...args: MXCreativeConsoleEvents[K]) => void,
	): this {
		this.device.on(eventName, listener)
		return this
	}
	public addListener<K extends keyof MXCreativeConsoleEvents>(
		eventName: K,
		listener: (...args: MXCreativeConsoleEvents[K]) => void,
	): this {
		this.device.addListener(eventName, listener)
		return this
	}
	public once<K extends keyof MXCreativeConsoleEvents>(
		eventName: K,
		listener: (...args: MXCreativeConsoleEvents[K]) => void,
	): this {
		this.device.once(eventName, listener)
		return this
	}
	public removeListener(...args: Parameters<MXCreativeConsole['removeListener']>): this {
		this.device.removeListener(...args)
		return this
	}
	public off(...args: Parameters<MXCreativeConsole['off']>): this {
		this.device.off(...args)
		return this
	}
	public removeAllListeners(...args: Parameters<MXCreativeConsole['removeAllListeners']>): this {
		this.device.removeAllListeners(...args)
		return this
	}
}
