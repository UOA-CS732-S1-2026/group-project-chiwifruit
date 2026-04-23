import { useEffect, useRef } from "react"

import backgroundMusicUrl from "../assets/audio/common/backgroundmusic.mp3"
import useSoundStore from "../store/useSoundStore"

// Plays looping background music for a page.
// Notes:
// - Most browsers block autoplay until the user interacts; we try immediately and
//   then retry once on first pointerdown/keydown.
// - The music respects the global mute toggle via `useSoundStore`.
export default function useBackgroundMusic({ enabled = true, volume = 0.22 } = {}) {
	const audioRef = useRef(null)
	const startedRef = useRef(false)
	const muted = useSoundStore((state) => state.muted)

	useEffect(() => {
		if (!enabled || muted) return

		const audio = new Audio(backgroundMusicUrl)
		audio.loop = true
		audio.preload = "auto"
		audio.volume = volume
		audioRef.current = audio

		const tryStart = () => {
			if (startedRef.current) return
			startedRef.current = true
			void audio.play().catch(() => {
				// Autoplay can be blocked; if so we remain silent.
				// (Click SFX will still work because it is user-gesture driven.)
			})
		}

		// Try immediately; if blocked, allow user gesture to start.
		tryStart()
		window.addEventListener("pointerdown", tryStart, { once: true, capture: true })
		window.addEventListener("keydown", tryStart, { once: true, capture: true })

		return () => {
			window.removeEventListener("pointerdown", tryStart, { capture: true })
			window.removeEventListener("keydown", tryStart, { capture: true })
			audio.pause()
			audio.currentTime = 0
			if (audioRef.current === audio) audioRef.current = null
			startedRef.current = false
		}
	}, [enabled, muted, volume])
}
