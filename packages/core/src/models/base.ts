import { EventEmitter } from 'eventemitter3'
import type { HIDDevice, HIDDeviceInfo } from '../hid-device.js'
import type { DeviceModelId, Dimension, KeyIndex } from '../id.js'
import type {
	FillImageOptions,
	FillPanelDimensionsOptions,
	FillPanelOptions,
	MXCreativeConsole,
	MXCreativeConsoleEvents,
} from '../types.js'
import type { ButtonsLcdDisplayService } from '../services/buttonsLcdDisplay/interface.js'
import type { MXConsoleButtonControlDefinition, MXConsoleControlDefinition } from '../controlDefinition.js'
import type { PropertiesService } from '../services/properties/interface.js'
import type { CallbackHook } from '../services/callback-hook.js'
import type { MXCreativeConsoleInputService } from '../services/input/interface.js'

export type EncodeJPEGHelper = (buffer: Uint8Array, width: number, height: number) => Promise<Uint8Array>

export interface OpenMXConsoleOptions {
	encodeJPEG?: EncodeJPEGHelper
}

export type MXConsoleProperties = Readonly<{
	MODEL: DeviceModelId
	PRODUCT_NAME: string

	CONTROLS: Readonly<MXConsoleControlDefinition[]>

	PANEL_SIZE?: Dimension
}>

/** The properties of a device which has a display */
export type MXConsolePanelProperties = MXConsoleProperties & Readonly<{ PANEL_SIZE: Dimension }>

export interface MXConsoleServicesDefinition {
	deviceProperties: MXConsoleProperties
	events: CallbackHook<MXCreativeConsoleEvents>
	/** Omitted by devices with nothing to configure, such as a device without a display */
	properties?: PropertiesService
	/** Omitted by devices without a display */
	buttonsLcd?: ButtonsLcdDisplayService
	inputService: MXCreativeConsoleInputService
}

export class MXConsoleBase extends EventEmitter<MXCreativeConsoleEvents> implements MXCreativeConsole {
	get CONTROLS(): Readonly<MXConsoleControlDefinition[]> {
		return this.deviceProperties.CONTROLS
	}

	get MODEL(): DeviceModelId {
		return this.deviceProperties.MODEL
	}
	get PRODUCT_NAME(): string {
		return this.deviceProperties.PRODUCT_NAME
	}

	protected readonly device: HIDDevice
	protected readonly deviceProperties: Readonly<MXConsoleProperties>
	// readonly #options: Readonly<Required<OpenMXConsoleOptions>>
	readonly #propertiesService: PropertiesService | undefined
	readonly #buttonsLcdService: ButtonsLcdDisplayService | undefined
	readonly #inputService: MXCreativeConsoleInputService

	constructor(
		device: HIDDevice,
		_options: Readonly<Required<OpenMXConsoleOptions>>,
		services: MXConsoleServicesDefinition,
	) {
		super()

		this.device = device
		this.deviceProperties = services.deviceProperties
		// this.#options = options
		this.#propertiesService = services.properties
		this.#buttonsLcdService = services.buttonsLcd
		this.#inputService = services.inputService

		// propogate events
		services.events?.listen((key, ...args) => this.emit(key, ...args))

		this.device.on('input', (reportId, data: Uint8Array) => this.#inputService.handleInput(reportId, data))

		this.device.on('error', (err) => {
			this.emit('error', err)
		})
	}

	protected checkValidKeyIndex(
		keyIndex: KeyIndex,
		feedbackType: MXConsoleButtonControlDefinition['feedbackType'] | null,
	): void {
		const buttonControl = this.deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)

		if (!buttonControl) {
			throw new TypeError(`Expected a valid keyIndex`)
		}

		if (feedbackType && buttonControl.feedbackType !== feedbackType) {
			throw new TypeError(`Expected a keyIndex with expected feedbackType`)
		}
	}

	/** The service backing everything drawn to the device, which devices without a display do not have */
	#getButtonsLcdService(): ButtonsLcdDisplayService {
		if (!this.#buttonsLcdService) throw new Error(`${this.PRODUCT_NAME} does not have a display`)
		return this.#buttonsLcdService
	}

	public calculateFillPanelDimensions(options?: FillPanelDimensionsOptions): Dimension | null {
		return this.#buttonsLcdService?.calculateFillPanelDimensions(options) ?? null
	}

	public async close(): Promise<void> {
		return this.device.close()
	}

	public async getHidDeviceInfo(): Promise<HIDDeviceInfo> {
		return this.device.getDeviceInfo()
	}

	public async setBrightness(percentage: number): Promise<void> {
		if (!this.#propertiesService) throw new Error(`${this.PRODUCT_NAME} does not support setting the brightness`)

		return this.#propertiesService.setBrightness(percentage)
	}

	public async resetToLogo(): Promise<void> {
		if (!this.#propertiesService) throw new Error(`${this.PRODUCT_NAME} does not have a logo to reset to`)

		return this.#propertiesService.resetToLogo()
		// const finish = new Uint8Array(20)
		// const finishView = uint8ArrayToDataView(finish)
		// finishView.setUint8(0, 0x11)
		// finishView.setUint8(1, 0xff)
		// finishView.setUint8(2, 0x04)
		// finishView.setUint8(3, 0x1b)
		// finishView.setUint8(4, 0x0b)
		// finishView.setUint8(5, 0xb8)

		// await this.device.sendReports([finish])
	}

	// public async getFirmwareVersion(): Promise<string> {
	// 	return this.#propertiesService.getFirmwareVersion()
	// }
	// public async getSerialNumber(): Promise<string> {
	// 	return this.#propertiesService.getSerialNumber()
	// }

	public async fillKeyColor(keyIndex: KeyIndex, r: number, g: number, b: number): Promise<void> {
		this.checkValidKeyIndex(keyIndex, null)

		await this.#getButtonsLcdService().fillKeyColor(keyIndex, r, g, b)
	}

	public async fillKeyBuffer(keyIndex: KeyIndex, imageBuffer: Uint8Array, options?: FillImageOptions): Promise<void> {
		this.checkValidKeyIndex(keyIndex, 'lcd')

		await this.#getButtonsLcdService().fillKeyBuffer(keyIndex, imageBuffer, options)
	}

	public async fillPanelBuffer(imageBuffer: Uint8Array, options?: FillPanelOptions): Promise<void> {
		await this.#getButtonsLcdService().fillPanelBuffer(imageBuffer, options)
	}

	public async clearKey(keyIndex: KeyIndex): Promise<void> {
		this.checkValidKeyIndex(keyIndex, null)

		await this.#getButtonsLcdService().clearKey(keyIndex)
	}

	public async clearPanel(): Promise<void> {
		// A device without a display has nothing to clear
		await this.#buttonsLcdService?.clearPanel()
	}
}
