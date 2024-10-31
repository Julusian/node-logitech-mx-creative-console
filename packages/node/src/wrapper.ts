import type { StreamDeck } from '@logi-mx-creative-console/core'
import { StreamDeckProxy } from '@logi-mx-creative-console/core'

export class StreamDeckNode extends StreamDeckProxy {
	constructor(
		device: StreamDeck,
		private readonly resetToLogoOnClose: boolean,
	) {
		super(device)
	}

	public async close(): Promise<void> {
		if (this.resetToLogoOnClose) {
			await this.resetToLogo()
		}
		await super.close()
	}
}
