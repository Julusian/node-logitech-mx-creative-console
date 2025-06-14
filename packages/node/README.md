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

`$ npm install --save @julusian/jpeg-turbo@^2.0.0` (Optional)

It is recommended to install `@julusian/jpeg-turbo` to greatly improve performance for writing images to the LCD. Without doing so `jpeg-js` will be used instead, but image transfers will be noticably more cpu intensive and slower. `jpeg-turbo` has prebuilt binaries, but is not installed by default to ensure installation is easy for users who do not need the performance.

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
export function listStreamDecks(): Promise<StreamDeckDeviceInfo[]>

/**
 * Get the info of a device if the given path is a streamdeck
 */
export function getStreamDeckInfo(path: string): Promise<StreamDeckDeviceInfo | undefined>

/**
 * Open a streamdeck
 * @param devicePath The path of the device to open.
 * @param userOptions Options to customise the device behvaiour
 */
export function openStreamDeck(devicePath: string, userOptions?: OpenStreamDeckOptionsNode): Promise<StreamDeck>
```

The StreamDeck type can be found [here](/packages/core/src/models/types.ts#L15)

## Example

```typescript
import { openStreamDeck, listStreamDecks } from '@logitech-mx-creative-console/node'

// List the connected streamdecks
const devices = await listStreamDecks()
if (devices.length === 0) throw new Error('No streamdecks connected!')

// You must provide the devicePath yourself as the first argument to the constructor.
// For example: const myStreamDeck = new StreamDeck('\\\\?\\hid#vid_05f3&pid_0405&mi_00#7&56cf813&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}')
// On linux the equivalent would be: const myStreamDeck = new StreamDeck('0001:0021:00')
const myStreamDeck = await openStreamDeck(devices[0].path)

myStreamDeck.on('down', (keyIndex) => {
	console.log('key %d down', keyIndex)
})

myStreamDeck.on('up', (keyIndex) => {
	console.log('key %d up', keyIndex)
})

// Fired whenever an error is detected by the `node-hid` library.
// Always add a listener for this event! If you don't, errors will be silently dropped.
myStreamDeck.on('error', (error) => {
	console.error(error)
})

// Fill the first button form the left in the first row with a solid red color. This is asynchronous.
await myStreamDeck.fillKeyColor(4, 255, 0, 0)
console.log('Successfully wrote a red square to key 4.')
```

Some more complex demos can be found in the [examples](examples/) folder.

## Contributing

The logitech-mx-creative-console team enthusiastically welcomes contributions and project participation! There's a bunch of things you can do if you want to contribute! Please don't hesitate to jump in if you'd like to, or even ask us questions if something isn't clear.

Please refer to the [Changelog](CHANGELOG.md) for project history details, too.
