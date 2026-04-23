import clickSfxUrl from "../assets/audio/common/click.mp3"
import useSoundStore from "../store/useSoundStore"

// Lazily created singleton Audio instance for click SFX.
// Reusing the same element avoids repeated network/decoder work.
let clickAudio

export function playClickSfx() {
	try {
		// Respect the global mute toggle.
		if (useSoundStore.getState().muted) return

		if (!clickAudio) {
			clickAudio = new Audio(clickSfxUrl)
			clickAudio.preload = "auto"
			clickAudio.volume = 0.7
		}

		clickAudio.currentTime = 0
		// `play()` must be called from a user gesture to reliably work.
		void clickAudio.play()
	} catch {
		// no-op: audio can fail due to browser policies
	}
}
