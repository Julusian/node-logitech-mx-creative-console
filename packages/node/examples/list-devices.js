import { listMXCreativeConsoleDevices } from '../dist/index.js'
import HID from 'node-hid'

console.log('RAW HID')
for (const dev of HID.devices()) {
	console.log(dev)
}

console.log('MX Creative Console')
listMXCreativeConsoleDevices().then((devs) => {
	for (const dev of devs) {
		console.log(dev)
	}
})
