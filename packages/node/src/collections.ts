import type { Device as NodeHIDDeviceInfo } from 'node-hid'

/** Matches the collection number windows embeds in both halves of a device path */
const WINDOWS_COLLECTION_RE = /&col\d+#([^#]*)&\d+#/i

/**
 * A key shared by every HID collection belonging to one physical device.
 *
 * Windows exposes each top level collection of a device as its own path, numbered in both halves
 * of the path (`&Col02#<instance>&0001`). Stripping that groups those paths back together. Other
 * platforms expose the whole device as a single path, which has nothing to strip and so forms a
 * group of one.
 */
export function devicePathGroupKey(path: string): string {
	return path.replace(WINDOWS_COLLECTION_RE, '#$1#')
}

/**
 * Whether a collection is one the console speaks its protocol over, rather than the keyboard and
 * consumer control collections which belong to the OS.
 * Platforms which don't report a usage page are assumed to expose the device as a single usable
 * collection.
 */
export function isProtocolCollection(device: NodeHIDDeviceInfo): boolean {
	return device.usagePage === undefined || device.usagePage >= 0xff00
}

/**
 * The report ids a collection carries.
 *
 * Logitech encodes these in the low byte of the collection usage, as one bit per report id
 * counting up from 0x10 (usage 0x1a10 -> bit 4 -> report 0x14). Windows gives each collection its
 * own handle and rejects reports belonging to a different one, so this is what decides where a
 * report has to be written.
 */
export function collectionReportIds(device: NodeHIDDeviceInfo): Set<number> {
	const reportIds = new Set<number>()

	const usage = device.usage ?? 0
	for (let bit = 0; bit < 8; bit++) {
		if (usage & (1 << bit)) reportIds.add(0x10 + bit)
	}

	return reportIds
}

/** The HID++ report the console is controlled over, carried by the collection identifying a device */
const CONTROL_REPORT_ID = 0x11

/**
 * Whether a collection is the one a device is identified and opened by.
 * A device split across multiple collections has to be reported as the one device it is, so only
 * the collection carrying the control report counts as being that device. Platforms exposing the
 * device as a single collection report no usage to narrow down, and are the device as a whole.
 */
export function isPrimaryCollection(device: NodeHIDDeviceInfo): boolean {
	if (!isProtocolCollection(device)) return false

	const reportIds = collectionReportIds(device)
	return reportIds.size === 0 || reportIds.has(CONTROL_REPORT_ID)
}

export interface MXCreativeConsoleCollection {
	path: string
	reportIds: Set<number>
}

/**
 * Find every collection of the device the given path belongs to, ordered so that the first is the
 * one a device is identified by.
 * Returns just the given path when it can't be found, leaving it to be used as a whole device.
 */
export function findDeviceCollections(devices: NodeHIDDeviceInfo[], devicePath: string): MXCreativeConsoleCollection[] {
	const groupKey = devicePathGroupKey(devicePath)

	const collections = devices
		.filter((dev) => !!dev.path && devicePathGroupKey(dev.path) === groupKey && isProtocolCollection(dev))
		.sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''))
		.map((dev) => ({ path: dev.path as string, reportIds: collectionReportIds(dev) }))

	if (collections.length === 0) return [{ path: devicePath, reportIds: new Set() }]

	return collections
}
