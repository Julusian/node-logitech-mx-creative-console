import type {
	MXConsoleButtonControlDefinition,
	MXConsoleButtonControlDefinitionLcdFeedback,
} from '../../controlDefinition.js'
import type { HIDDevice } from '../../hid-device.js'
import type { Dimension, KeyIndex } from '../../id.js'
import type { MXConsoleProperties } from '../../models/base.js'
import type { FillPanelDimensionsOptions, FillImageOptions, FillPanelOptions } from '../../types.js'
import type { MXConsoleImageWriter } from '../imageWriter/types.js'
import type { ButtonsLcdDisplayService, GridSpan } from './interface.js'
import type { ButtonLcdImagePacker, InternalFillImageOptions } from '../imagePacker/interface.js'

export class DefaultButtonsLcdService implements ButtonsLcdDisplayService {
	readonly #imageWriter: MXConsoleImageWriter
	readonly #imagePacker: ButtonLcdImagePacker
	readonly #device: Pick<HIDDevice, 'sendReports' | 'sendFeatureReport'>
	readonly #deviceProperties: Readonly<MXConsoleProperties>

	constructor(
		imageWriter: MXConsoleImageWriter,
		imagePacker: ButtonLcdImagePacker,
		device: Pick<HIDDevice, 'sendReports' | 'sendFeatureReport'>,
		deviceProperties: Readonly<MXConsoleProperties>,
	) {
		this.#imageWriter = imageWriter
		this.#imagePacker = imagePacker
		this.#device = device
		this.#deviceProperties = deviceProperties
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

	private calculateDimensionsFromGridSpan(
		gridSpan: GridSpan,
		buttonPixelSize: Dimension,
		withPadding: boolean | undefined,
	): Dimension {
		if (withPadding) {
			// TODO: Implement padding
			throw new Error('Not implemented')
		} else {
			const rowCount = gridSpan.maxRow - gridSpan.minRow + 1
			const columnCount = gridSpan.maxCol - gridSpan.minCol + 1

			// TODO: Consider that different rows/columns could have different dimensions

			return { width: columnCount * buttonPixelSize.width, height: rowCount * buttonPixelSize.height }
		}
	}

	public calculateFillPanelDimensions(options: FillPanelDimensionsOptions | undefined): Dimension | null {
		const buttonLcdControls = this.getLcdButtonControls()
		const gridSpan = this.calculateLcdGridSpan(buttonLcdControls)

		if (!gridSpan || buttonLcdControls.length === 0) return null

		return this.calculateDimensionsFromGridSpan(gridSpan, buttonLcdControls[0].pixelSize, options?.withPadding)
	}

	public async clearPanel(): Promise<void> {
		const ps: Promise<void>[] = []

		const blackBuffer = new Uint8Array(
			this.#deviceProperties.PANEL_SIZE.width * this.#deviceProperties.PANEL_SIZE.height * 4,
		)

		// TODO - cache this?
		const byteBuffer = await this.#imagePacker.convertPixelBuffer(
			blackBuffer,
			{ format: 'rgba', offset: 0, stride: this.#deviceProperties.PANEL_SIZE.width * 4 },
			this.#deviceProperties.PANEL_SIZE,
		)

		const packets = this.#imageWriter.generateFillImageWrites(
			{ pixelSize: this.#deviceProperties.PANEL_SIZE, pixelPosition: { x: 0, y: 0 } },
			byteBuffer,
		)
		ps.push(this.#device.sendReports(packets))

		/*
			for (const control of this.#deviceProperties.CONTROLS) {
				if (control.type !== 'button') continue

				switch (control.feedbackType) {
					case 'lcd': {
						// Handled by PANEL_SIZE


						break
					}
					case 'none':
						// Do nothing
						break
				}
			}
			*/

		await Promise.all(ps)
	}

	public async clearKey(keyIndex: KeyIndex): Promise<void> {
		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType === 'none') throw new TypeError(`Expected a valid keyIndex`)

		const pixels = new Uint8Array(control.pixelSize.width * control.pixelSize.height * 3)
		await this.fillImageRangeControl(control, pixels, {
			format: 'rgb',
			offset: 0,
			stride: control.pixelSize.width * 3,
		})
	}

	public async fillKeyColor(keyIndex: KeyIndex, r: number, g: number, b: number): Promise<void> {
		this.checkRGBValue(r)
		this.checkRGBValue(g)
		this.checkRGBValue(b)

		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType === 'none') throw new TypeError(`Expected a valid keyIndex`)

		// rgba is excessive here, but it makes the fill easier as it can be done in a 32bit uint
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

		await this.fillImageRangeControl(control, pixels, {
			format: 'rgba',
			offset: 0,
			stride: control.pixelSize.width * 4,
		})
	}

	public async fillKeyBuffer(keyIndex: KeyIndex, imageBuffer: Uint8Array, options?: FillImageOptions): Promise<void> {
		const sourceFormat = options?.format ?? 'rgb'
		this.checkSourceFormat(sourceFormat)

		const control = this.#deviceProperties.CONTROLS.find(
			(control): control is MXConsoleButtonControlDefinition =>
				control.type === 'button' && control.index === keyIndex,
		)
		if (!control || control.feedbackType === 'none') throw new TypeError(`Expected a valid keyIndex`)

		const imageSize = control.pixelSize.width * control.pixelSize.height * sourceFormat.length
		if (imageBuffer.length !== imageSize) {
			throw new RangeError(`Expected image buffer of length ${imageSize}, got length ${imageBuffer.length}`)
		}

		await this.fillImageRangeControl(control, imageBuffer, {
			format: sourceFormat,
			offset: 0,
			stride: control.pixelSize.width * sourceFormat.length,
		})
	}

	public async fillPanelBuffer(imageBuffer: Uint8Array, options?: FillPanelOptions): Promise<void> {
		const sourceFormat = options?.format ?? 'rgb'
		this.checkSourceFormat(sourceFormat)

		const buttonLcdControls = this.getLcdButtonControls()
		const panelGridSpan = this.calculateLcdGridSpan(buttonLcdControls)

		if (!panelGridSpan || buttonLcdControls.length === 0) {
			throw new Error(`Panel does not support being filled`)
		}

		const panelDimensions = this.calculateDimensionsFromGridSpan(
			panelGridSpan,
			buttonLcdControls[0].pixelSize,
			options?.withPadding,
		)

		const expectedByteCount = sourceFormat.length * panelDimensions.width * panelDimensions.height
		if (imageBuffer.length !== expectedByteCount) {
			throw new RangeError(
				`Expected image buffer of length ${expectedByteCount}, got length ${imageBuffer.length}`,
			)
		}

		const stride = panelDimensions.width * sourceFormat.length

		const ps: Array<Promise<void>> = []
		for (const control of buttonLcdControls) {
			const controlRow = control.row - panelGridSpan.minRow
			const controlCol = control.column - panelGridSpan.minCol

			// TODO: Consider that different rows/columns could have different dimensions
			const iconSize = control.pixelSize.width * sourceFormat.length

			const rowOffset = stride * controlRow * control.pixelSize.height
			const colOffset = controlCol * iconSize

			// TODO: Implement padding
			ps.push(
				this.fillImageRangeControl(control, imageBuffer, {
					format: sourceFormat,
					offset: rowOffset + colOffset,
					stride,
				}),
			)
		}

		await Promise.all(ps)
	}

	private async fillImageRangeControl(
		buttonControl: MXConsoleButtonControlDefinitionLcdFeedback,
		imageBuffer: Uint8Array,
		sourceOptions: InternalFillImageOptions,
	) {
		if (buttonControl.feedbackType !== 'lcd')
			throw new TypeError(`keyIndex ${buttonControl.index} does not support lcd feedback`)

		const byteBuffer = await this.#imagePacker.convertPixelBuffer(
			imageBuffer,
			sourceOptions,
			buttonControl.pixelSize,
		)

		const packets = this.#imageWriter.generateFillImageWrites(
			{ pixelSize: buttonControl.pixelSize, pixelPosition: buttonControl.pixelPosition },
			byteBuffer,
		)
		await this.#device.sendReports(packets)
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
