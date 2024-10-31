import type { MXCreativeConsole } from '@logi-mx-creative-console/core'
import { StreamDeckProxy } from '@logi-mx-creative-console/core'

export class StreamDeckNode extends StreamDeckProxy {
	constructor(
		device: MXCreativeConsole,
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
