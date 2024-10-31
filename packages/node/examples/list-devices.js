import { listStreamDecks } from '../dist/index.js'
import HID from 'node-hid'

console.log('RAW HID')
for (const dev of HID.devices()) {
	console.log(dev)
}

console.log('MX Creative Console')
listStreamDecks().then((devs) => {
	for (const dev of devs) {
		console.log(dev)
	}
})
