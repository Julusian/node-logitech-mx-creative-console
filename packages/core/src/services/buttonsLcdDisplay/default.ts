import type {
	MXConsoleButtonControlDefinition,
	MXConsoleButtonControlDefinitionLcdFeedback,
} from '../../controlDefinition.js'
import type { HidppTransport } from '../../hidpp.js'
import type { Dimension, KeyIndex } from '../../id.js'
import type { MXConsolePanelProperties } from '../../models/base.js'
import type { FillPanelDimensionsOptions, FillImageOptions, FillPanelOptions } from '../../types.js'
import { transformImageBuffer } from '../../util.js'
import type { MXConsoleImageWriter } from '../imageWriter/types.js'
import type { ButtonsLcdDisplayService, GridSpan } from './interface.js'
import type { ButtonLcdImagePacker, InternalFillImageOptions } from '../imagePacker/interface.js'
import { LcdDrawQueue, type Region } from './drawQueue.js'

export class DefaultButtonsLcdService implements ButtonsLcdDisplayService {
	readonly #deviceProperties: Readonly<MXConsolePanelProperties>
	readonly #drawQueue: LcdDrawQueue

	constructor(
		imageWriter: MXConsoleImageWriter,
		imagePacker: ButtonLcdImagePacker,
		transport: Pick<HidppTransport, 'runExclusive'>,
		deviceProperties: Readonly<MXConsolePanelProperties>,
	) {
		this.#deviceProperties = deviceProperties

		const keys = new Map<number, Region>()
		for (const control of this.getLcdButtonControls()) {
			keys.set(control.index, { ...control.pixelPosition, ...control.pixelSize })
		}
		this.#drawQueue = new LcdDrawQueue(imageWriter, imagePacker, transport, keys, deviceProperties.PANEL_SIZE)
	}

	private getLcdButtonControls(): MXConsoleButtonControlDefinitionLcdFeedback[] {
		return this.#deviceProperties.CONTROLS.filter(
			(control): control is MXConsoleButtonControlDefinitionLcdFeedback =>
				control.type === 'button' && control.feedbackType === 'lcd',
		)
	}

	private calculateLcdGridSpan(buttonsLcd: MXConsoleButtonControlDefinition[]): GridSpan | null {
		if (buttonsLcd.length === 0) return null

		const allRowValues = buttonsLcd.map((button) => button.row)
		const allColumnValues = buttonsLcd.map((button) => button.column)

		return {
			minRow: Math.min(...allRowValues),
			maxRow: Math.max(...allRowValues),
			minCol: Math.min(...allColumnValues),
			maxCol: Math.max(...allColumnValues),
		}
	}

	private calculateDimensionsFromGridSpan(gridSpan: GridSpan, buttonPixelSize: Dimension): Dimension {
		const rowCount = gridSpan.maxRow - gridSpan.minRow + 1
		const columnCount = gridSpan.maxCol - gridSpan.minCol + 1

		// TODO: Consider that different rows/columns could have different dimensions

		return { width: columnCount * buttonPixelSize.width, height: rowCount * buttonPixelSize.height }
	}

	public calculateFillPanelDimensions(options: FillPanelDimensionsOptions | undefined): Dimension | null {
		const buttonLcdControls = this.getLcdButtonControls()
		const gridSpan = this.calculateLcdGridSpan(buttonLcdControls)

		if (!gridSpan || buttonLcdControls.length === 0) return null

		if (options?.withPadding) {
			const bounds = this.#drawQueue.bounds
			return { width: bounds.width, height: bounds.height }
		}

		return this.calculateDimensionsFromGridSpan(gridSpan, buttonLcdControls[0].pixelSize)
	}

	public async clearPanel(): Promise<void> {
		await this.#drawQueue.clear()
	}

	public async clearKey(keyIndex: KeyIndex): Promise<void> {
		const control = this.getLcdButtonControl(keyIndex)

		const pixels = new Uint8Array(control.pixelSize.width * control.pixelSize.height * 4)
		await this.#drawQueue.updateKeys([{ index: keyIndex, pixels }])
	}

	public async fillKeyColor(keyIndex: KeyIndex, r: number, g: number, b: number): Promise<void> {
		this.checkRGBValue(r)
		this.checkRGBValue(g)
		this.checkRGBValue(b)

		const control = this.getLcdButtonControl(keyIndex)

		const pixelCount = control.pixelSize.width * control.pixelSize.height
		const pixels = new Uint8Array(pixelCount * 4)
		const view = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength)

		// write first pixel
		view.setUint8(0, r)
		view.setUint8(1, g)
		view.setUint8(2, b)
		view.setUint8(3, 255)

		// read computed pixel
		const sample = view.getUint32(0)
		// fill with computed pixel
		for (let i = 1; i < pixelCount; i++) {
			view.setUint32(i * 4, sample)
		}

		await this.#drawQueue.updateKeys([{ index: keyIndex, pixels }])
	}

	public async fillKeyBuffer(keyIndex: KeyIndex, imageBuffer: Uint8Array, options?: FillImageOptions): Promise<void> {
		const sourceFormat = options?.format ?? 'rgb'
		this.checkSourceFormat(sourceFormat)

		const control = this.getLcdButtonControl(keyIndex)

		const imageSize = control.pixelSize.width * control.pixelSize.height * sourceFormat.length
		if (imageBuffer.length !== imageSize) {
			throw new RangeError(`Expected image buffer of length ${imageSize}, got length ${imageBuffer.length}`)
		}

		const pixels = toRgba(
			imageBuffer,
			{ format: sourceFormat, offset: 0, stride: control.pixelSize.width * sourceFormat.length },
			control.pixelSize,
		)
		await this.#drawQueue.updateKeys([{ index: keyIndex, pixels }])
	}

	public async fillPanelBuffer(imageBuffer: Uint8Array, options?: FillPanelOptions): Promise<void> {
		const sourceFormat = options?.format ?? 'rgb'
		this.checkSourceFormat(sourceFormat)

		const buttonLcdControls = this.getLcdButtonControls()
		const panelGridSpan = this.calculateLcdGridSpan(buttonLcdControls)

		if (!panelGridSpan || buttonLcdControls.length === 0) {
			throw new Error(`Panel does not support being filled`)
		}

		const panelDimensions = options?.withPadding
			? this.#drawQueue.bounds
			: this.calculateDimensionsFromGridSpan(panelGridSpan, buttonLcdControls[0].pixelSize)

		const expectedByteCount = sourceFormat.length * panelDimensions.width * panelDimensions.height
		if (imageBuffer.length !== expectedByteCount) {
			throw new RangeError(
				`Expected image buffer of length ${expectedByteCount}, got length ${imageBuffer.length}`,
			)
		}

		const stride = panelDimensions.width * sourceFormat.length

		if (options?.withPadding) {
			await this.#drawQueue.updateAll(
				toRgba(imageBuffer, { format: sourceFormat, offset: 0, stride }, panelDimensions),
			)
			return
		}

		// All the keys are updated at once, so they are drawn as a single image rather than visibly rippling across the panel
		await this.#drawQueue.updateKeys(
			buttonLcdControls.map((control) => {
				// TODO: Consider that different rows/columns could have different dimensions
				const rowOffset = stride * (control.row - panelGridSpan.minRow) * control.pixelSize.height
				const colOffset =
					(control.column - panelGridSpan.minCol) * control.pixelSize.width * sourceFormat.length

				return {
					index: control.index,
					pixels: toRgba(
						imageBuffer,
						{ format: sourceFormat, offset: rowOffset + colOffset, stride },
						control.pixelSize,
					),
				}
			}),
		)
	}

	private getLcdButtonControl(keyIndex: KeyIndex): MXConsoleButtonControlDefinitionLcdFeedback {
		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType !== 'lcd') throw new TypeError(`Expected a valid keyIndex`)

		return control
	}

	private checkRGBValue(value: number): void {
		if (value < 0 || value > 255) {
			throw new TypeError('Expected a valid color RGB value 0 - 255')
		}
	}

	private checkSourceFormat(format: 'rgb' | 'rgba' | 'bgr' | 'bgra'): void {
		switch (format) {
			case 'rgb':
			case 'rgba':
			case 'bgr':
			case 'bgra':
				break
			default: {
				const fmt: never = format
				throw new TypeError(`Expected a known color format not "${fmt as string}"`)
			}
		}
	}
}

function toRgba(imageBuffer: Uint8Array, sourceOptions: InternalFillImageOptions, size: Dimension): Uint8Array {
	return transformImageBuffer(imageBuffer, sourceOptions, { colorMode: 'rgba' }, 0, size.width, size.height)
}
