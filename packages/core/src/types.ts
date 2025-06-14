import type { EventEmitter } from 'node:events'
import type { DeviceModelId, Dimension, KeyIndex } from './id.js'
import type { HIDDeviceInfo } from './hid-device.js'
import type {
	MXConsoleButtonControlDefinition,
	MXConsoleControlDefinition,
	MXConsoleEncoderControlDefinition,
} from './controlDefinition.js'

export interface FillImageOptions {
	format: 'rgb' | 'rgba' | 'bgr' | 'bgra'
}
export interface FillPanelOptions extends FillImageOptions, FillPanelDimensionsOptions {}

export interface FillPanelDimensionsOptions {
	withPadding?: boolean
}

export interface FillLcdImageOptions extends FillImageOptions {
	width: number
	height: number
}

export interface LcdPosition {
	x: number
	y: number
}

export type MXCreativeConsoleEvents = {
	down: [control: MXConsoleButtonControlDefinition | MXConsoleEncoderControlDefinition]
	up: [control: MXConsoleButtonControlDefinition | MXConsoleEncoderControlDefinition]
	error: [err: unknown]
	rotate: [control: MXConsoleEncoderControlDefinition, amount: number]
}

export interface MXCreativeConsole extends EventEmitter<MXCreativeConsoleEvents> {
	/** List of the controls on this surface */
	readonly CONTROLS: Readonly<MXConsoleControlDefinition[]>

	/** The model of this device */
	readonly MODEL: DeviceModelId
	/** The name of the product/model */
	readonly PRODUCT_NAME: string

	/**
	 * Calculate the dimensions to use for `fillPanelBuffer`, to fill the whole button lcd panel with a single image.
	 * @param options Options to control the write
	 * @returns The dimensions to use for the image, or null if there is no panel
	 */
	calculateFillPanelDimensions(options?: FillPanelDimensionsOptions): Dimension | null

	/**
	 * Close the device
	 */
	close(): Promise<void>

	/**
	 * Get information about the underlying HID device
	 */
	getHidDeviceInfo(): Promise<HIDDeviceInfo>

	/**
	 * Fills the given key with a solid color.
	 *
	 * @param {number} keyIndex The key to fill
	 * @param {number} r The color's red value. 0 - 255
	 * @param {number} g The color's green value. 0 - 255
	 * @param {number} b The color's blue value. 0 -255
	 */
	fillKeyColor(keyIndex: KeyIndex, r: number, g: number, b: number): Promise<void>

	/**
	 * Fills the given key with an image in a Buffer.
	 *
	 * @param {number} keyIndex The key to fill
	 * @param {Buffer} imageBuffer The image to write
	 * @param {Object} options Options to control the write
	 */
	fillKeyBuffer(
		keyIndex: KeyIndex,
		imageBuffer: Uint8Array | Uint8ClampedArray,
		options?: FillImageOptions,
	): Promise<void>

	/**
	 * Fills the whole panel with an image in a Buffer.
	 *
	 * @param {Buffer} imageBuffer The image to write
	 * @param {Object} options Options to control the write
	 */
	fillPanelBuffer(imageBuffer: Uint8Array | Uint8ClampedArray, options?: FillPanelOptions): Promise<void>

	/**
	 * Clears the given key.
	 *
	 * @param {number} keyIndex The key to clear
	 */
	clearKey(keyIndex: KeyIndex): Promise<void>

	/**
	 * Clears all keys.
	 */
	clearPanel(): Promise<void>

	/**
	 * Sets the brightness of the keys on the Stream Deck
	 *
	 * @param {number} percentage The percentage brightness
	 */
	setBrightness(percentage: number): Promise<void>

	/**
	 * Resets the display to the startup logo
	 */
	resetToLogo(): Promise<void>

	// /**
	//  * Get firmware version from Stream Deck
	//  */
	// getFirmwareVersion(): Promise<string>

	// /**
	//  * Get serial number from Stream Deck
	//  */
	// getSerialNumber(): Promise<string>
}
