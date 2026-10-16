import { describe, expect, test } from 'vitest'
import { DEVICE_MODELS, findModelByUsb, getModelInfo } from '../modelInfo.js'
import type { MXConsoleModelInfo } from '../modelInfo.js'
import { getDriver } from '../registry.js'

describe('model info', () => {
	const models = Object.values<MXConsoleModelInfo>(DEVICE_MODELS)

	test('snapshot', () => {
		// The data is transcribed by hand, so make every change to it visible in review
		expect(DEVICE_MODELS).toMatchSnapshot()
	})

	test('survives a json round-trip', () => {
		// toStrictEqual, as toEqual would ignore a property which is undefined
		expect(JSON.parse(JSON.stringify(DEVICE_MODELS))).toStrictEqual(DEVICE_MODELS)
	})

	test('each model is keyed by its own id', () => {
		for (const [id, model] of Object.entries<MXConsoleModelInfo>(DEVICE_MODELS)) {
			expect(model.id).toBe(id)
			expect(getModelInfo(model.id)).toBe(model)
		}
	})

	test('control ids are unique within each model', () => {
		// Consumers persist these, so a duplicate would make two controls indistinguishable
		const duplicates: string[] = []
		for (const model of models) {
			const seen = new Set<string>()
			for (const control of model.controls) {
				const key = `${control.type}:${control.id}`
				if (seen.has(key)) duplicates.push(`${model.id} ${key}`)
				seen.add(key)
			}
		}
		expect(duplicates).toEqual([])
	})

	test('usb ids are unique across models', () => {
		// Matched without the usage or interface when the caller doesn't provide them, so those can't disambiguate
		const owners = new Map<string, string>()
		const duplicates: string[] = []
		for (const model of models) {
			for (const match of model.usb) {
				const key = `${match.vendorId.toString(16)}:${match.productId.toString(16)}`
				const owner = owners.get(key)
				if (owner !== undefined) duplicates.push(`${key} (${owner} & ${model.id})`)
				owners.set(key, model.id)
			}
		}
		expect(duplicates).toEqual([])
	})

	test('every usb match finds its own model', () => {
		for (const model of models) {
			for (const match of model.usb) {
				expect(findModelByUsb(match.vendorId, match.productId)).toBe(model)
			}
		}
		expect(findModelByUsb(0x046d, 0x0000)).toBeUndefined()
	})

	test('every model has a driver', () => {
		for (const model of models) {
			expect(getDriver(model.id)).toBeTypeOf('function')
		}
	})
})
