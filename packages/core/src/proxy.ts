import type { EventEmitter } from 'eventemitter3'
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

	public eventNames(): Array<EventEmitter.EventNames<MXCreativeConsoleEvents>> {
		return this.device.eventNames()
	}

	public listeners<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
	): Array<EventEmitter.EventListener<MXCreativeConsoleEvents, T>> {
		return this.device.listeners(event)
	}

	public listenerCount(event: EventEmitter.EventNames<MXCreativeConsoleEvents>): number {
		return this.device.listenerCount(event)
	}

	public emit<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
		...args: EventEmitter.EventArgs<MXCreativeConsoleEvents, T>
	): boolean {
		return this.device.emit(event, ...args)
	}

	/**
	 * Add a listener for a given event.
	 */
	public on<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
		fn: EventEmitter.EventListener<MXCreativeConsoleEvents, T>,
		context?: unknown,
	): this {
		this.device.on(event, fn, context)
		return this
	}
	public addListener<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
		fn: EventEmitter.EventListener<MXCreativeConsoleEvents, T>,
		context?: unknown,
	): this {
		this.device.addListener(event, fn, context)
		return this
	}

	/**
	 * Add a one-time listener for a given event.
	 */
	public once<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
		fn: EventEmitter.EventListener<MXCreativeConsoleEvents, T>,
		context?: unknown,
	): this {
		this.device.once(event, fn, context)
		return this
	}

	/**
	 * Remove the listeners of a given event.
	 */
	public removeListener<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
		fn?: EventEmitter.EventListener<MXCreativeConsoleEvents, T>,
		context?: unknown,
		once?: boolean,
	): this {
		this.device.removeListener(event, fn, context, once)
		return this
	}
	public off<T extends EventEmitter.EventNames<MXCreativeConsoleEvents>>(
		event: T,
		fn?: EventEmitter.EventListener<MXCreativeConsoleEvents, T>,
		context?: unknown,
		once?: boolean,
	): this {
		this.device.off(event, fn, context, once)
		return this
	}

	public removeAllListeners(event?: EventEmitter.EventNames<MXCreativeConsoleEvents>): this {
		this.device.removeAllListeners(event)
		return this
	}
}
