# Changelog

All notable changes to this project will be documented in this file. See [Convential Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification) for commit guidelines.

## [0.4.0](https://github.com/Julusian/node-logitech-mx-creative-console/compare/v0.3.0...v0.4.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* The deprecated apis replaced by the model info are removed:
    - DEVICE_MODELS, DEVICE_MODELS2 and DeviceModelSpec: use DEVICE_MODEL_INFO
      and getDriver
    - MODEL_NAMES: use DEVICE_MODEL_INFO[id].name
    - CONTROLS, MODEL and PRODUCT_NAME on a device: use modelInfo
    - model on a discovered device: use modelInfo.id
    - hidId on a button: use hidIndex
    - pixelPosition on an lcd button: use bounds

### Features

* add Dialpad Support, improve the prevention of fast displaying bugs [#22](https://github.com/Julusian/node-logitech-mx-creative-console/issues/22) ([985767d](https://github.com/Julusian/node-logitech-mx-creative-console/commit/985767d95a6f6655603d72b0b91a55245d385ca6))
* better batching of lcd draws ([d9c0c11](https://github.com/Julusian/node-logitech-mx-creative-console/commit/d9c0c11e08000638b0ebea1bd44b2b432fbd6335))
* expose model info from the node and webhid packages ([6014d15](https://github.com/Julusian/node-logitech-mx-creative-console/commit/6014d15e4ee1f907cf89a24b4574a7ca42307a39))
* fill the keypad panel with a single image write ([f662c3f](https://github.com/Julusian/node-logitech-mx-creative-console/commit/f662c3fc590a27eda8fb0fed3d68da1b958b61e2))
* remove the deprecated model and control apis ([43f35e5](https://github.com/Julusian/node-logitech-mx-creative-console/commit/43f35e565d28da4144cb165988fad742b4c435a5))
* send HID++ requests through a central transport, resending images the device is too busy for ([5c07525](https://github.com/Julusian/node-logitech-mx-creative-console/commit/5c075256fe4b92d8cd044f9c3ecc9de9465368f7))
* unified model info and control bounds ([58176c0](https://github.com/Julusian/node-logitech-mx-creative-console/commit/58176c01c47959883b1c66b8171cd3ebaf45746e))


### Bug Fixes

* measure the page buttons and dialpad geometry from a product photo ([4279ef9](https://github.com/Julusian/node-logitech-mx-creative-console/commit/4279ef9c42d9c6c0f7ed7317b78fcc3cf2640d77))

## [0.3.0](https://github.com/Julusian/node-logitech-mx-creative-console/compare/v0.2.3...v0.3.0) (2026-05-12)


### Features

* make @julusian/jpeg-turbo a required dependency in node ([dcd9195](https://github.com/Julusian/node-logitech-mx-creative-console/commit/dcd91957d616357aa7241e3935ec1558768265b2))
* require node 22 ([c343933](https://github.com/Julusian/node-logitech-mx-creative-console/commit/c343933c0cb790e4d99c7b96c12425f152d5884c))


### Bug Fixes

* lint ([e28c86d](https://github.com/Julusian/node-logitech-mx-creative-console/commit/e28c86db6a68743e2cac9b3d6aa5be8953471499))

## [0.2.3](https://github.com/julusian/node-logitech-mx-creative-console/compare/v0.2.2...v0.2.3) (Sun Jun 15 2025)


### Fixes

* publish [c9b3c46](https://github.com/julusian/node-logitech-mx-creative-console/commit/c9b3c46cf523b529b528e7b488e1e438d2f8fad5)

## [0.2.2](https://github.com/julusian/node-logitech-mx-creative-console/compare/v0.2.1...v0.2.2) (Sun Jun 15 2025)


### Fixes

* publish [3f4df29](https://github.com/julusian/node-logitech-mx-creative-console/commit/3f4df29a0b414242c2a57b79564d53ff5ba62eb4)

## [0.2.1](https://github.com/julusian/node-logitech-mx-creative-console/commits/v0.2.1) (Sun Jun 15 2025)


## [0.2.0](https://github.com/Julusian/node-logitech-mx-creative-console/compare/v0.1.0...v0.2.0) (2025-06-14)


### Features

* prepare for initial release ([e191790](https://github.com/Julusian/node-logitech-mx-creative-console/commit/e19179069cdcb82bca8bb24095092a193800467e))

## Change Log
