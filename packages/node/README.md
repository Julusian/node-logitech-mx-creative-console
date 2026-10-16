# @logitech-mx-creative-console/node

![Node CI](https://github.com/Julusian/node-logitech-mx-creative-console/workflows/Node%20CI/badge.svg)
[![codecov](https://codecov.io/gh/Julusian/node-logitech-mx-creative-console/branch/master/graph/badge.svg?token=Hl4QXGZJMF)](https://codecov.io/gh/Julusian/node-logitech-mx-creative-console)

[![npm version](https://img.shields.io/npm/v/@logitech-mx-creative-console/node.svg)](https://npm.im/@logitech-mx-creative-console/node)
[![license](https://img.shields.io/npm/l/@logitech-mx-creative-console/node.svg)](https://npm.im/@logitech-mx-creative-console/node)

[@logitech-mx-creative-console/node](https://www.npmjs.com/org/logitech-mx-creative-console) is a library for interfacing with the various models of the [Logitech MX Creative Console](https://www.logitech.com/en-gb/products/keyboards/mx-creative-console.html).

## Intended use

This library has nothing to do with the official software produced by Logi. There is nothing here to install and run. This is a library to help developers make alternatives to that software

## Install

`$ npm install --save @logitech-mx-creative-console/node`

### Native dependencies

All of this library's native dependencies ship with prebuilt binaries, so having a full compiler toolchain should not be necessary to install `@logitech-mx-creative-console/node`.

## Linux

On linux, the udev subsystem blocks access to the MXConsole without some special configuration.
Copy one of the following files into `/etc/udev/rules.d/` and reload the rules with `sudo udevadm control --reload-rules`

- Use the [headless server](./udev/50-logi-mx-creative-console-headless.rules) version when your software will be running as a system service, and is not related to a logged in user
- Use the [desktop user](./udev/50-logi-mx-creative-console-user.rules) version when your software is run by a user session on a distribution using systemd

Unplug and replug the device and it should be usable

## API

The root methods exposed by the library are as follows. For more information it is recommended to rely on the typescript typings for hints or to browse through the source to see what methods are available

```typescript
/**
 * Scan for and list detected devices
 */
export function listMXCreativeConsoleDevices(): Promise<MXCreativeConsoleDeviceInfo[]>

/**
 * Get the info of a device if the given path is a MXConsole
 */
export function getMXCreativeConsoleInfo(path: string): Promise<MXCreativeConsoleDeviceInfo | undefined>

/**
 * Open a device
 * @param devicePath The path of the device to open.
 * @param userOptions Options to customise the device behvaiour
 */
export function openMxCreativeConsole(
	devicePath: string,
	userOptions?: OpenMXCreativeConsoleOptionsNode,
): Promise<MXCreativeConsole>
```

The MXCreativeConsole type can be found [here](/packages/core/src/types.ts)

## Example

```typescript
import { openMxCreativeConsole, listMXCreativeConsoleDevices } from '@logitech-mx-creative-console/node'

// List the connected devices
const devices = await listMXCreativeConsoleDevices()
if (devices.length === 0) throw new Error('No MX Creative Console connected!')

// You must provide the devicePath yourself as the first argument to the constructor.
const myDevice = await openMxCreativeConsole(devices[0].path)

myDevice.on('down', (key) => {
	console.log('key %d down', key.index)
})

myDevice.on('up', (key) => {
	console.log('key %d up', key.index)
})

// Fired whenever an error is detected by the `node-hid` library.
// Always add a listener for this event! If you don't, errors will cause a crash.
myDevice.on('error', (error) => {
	console.error(error)
})

// Fill the first button form the left in the first row with a solid red color. This is asynchronous.
await myDevice.fillKeyColor(4, 255, 0, 0)
console.log('Successfully wrote a red square to key 4.')
```

Some more complex demos can be found in the [examples](examples/) folder.

## Model information

Every supported model is described as plain data in `DEVICE_MODELS`, so a UI can be built for a device without opening it. Each model lists its controls, along with where each control sits on the face of the device, and its usb identifiers.

```typescript
import { DEVICE_MODELS, listMXCreativeConsoleDevices } from '@logitech-mx-creative-console/node'

for (const model of Object.values(DEVICE_MODELS)) {
	console.log(`${model.name} is ${model.faceSize.width}x${model.faceSize.height}`)
	for (const control of model.controls) {
		console.log(`  ${control.type} ${control.id} at`, control.bounds)
	}
}

// Discovered devices carry the same info, as does `modelInfo` on an opened device
const devices = await listMXCreativeConsoleDevices()
console.log(devices[0]?.modelInfo.name)
```

For the Keypad, the `bounds` are in panel pixels, so the bounds of a button are also the region it occupies in an image filling the panel. The Dialpad uses the same units, so the two can be drawn to scale. The controls outside the panel are measured from a product photo, so are approximate.

## Contributing

The logitech-mx-creative-console team enthusiastically welcomes contributions and project participation! There's a bunch of things you can do if you want to contribute! Please don't hesitate to jump in if you'd like to, or even ask us questions if something isn't clear.

Please refer to the [Changelog](CHANGELOG.md) for project history details, too.
