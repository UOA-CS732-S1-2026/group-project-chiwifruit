import clickSfxUrl from "../assets/audio/common/click.mp3"
import useSoundStore from "../store/useSoundStore"

let clickAudio

export function playClickSfx() {
	try {
		if (useSoundStore.getState().muted) return

		if (!clickAudio) {
			clickAudio = new Audio(clickSfxUrl)
			clickAudio.preload = "auto"
			clickAudio.volume = 0.7
		}

		clickAudio.currentTime = 0
		// play() must be called from a user gesture to reliably work.
		void clickAudio.play()
	} catch {
		// no-op: audio can fail due to browser policies
	}
}
