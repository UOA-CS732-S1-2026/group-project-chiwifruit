import { useEffect } from "react"
import useSoundStore from "../store/useSoundStore"
import {
	disableBackgroundMusicAutoplayRetry,
	enableBackgroundMusicAutoplayRetry,
	pauseBackgroundMusic,
	setBackgroundMusicVolume,
	startBackgroundMusic,
	syncBackgroundMusicWithMute,
} from "../lib/sound"

// NOTE (2026-04-29): 页面级背景音乐 hook。
// 重点处理：浏览器 autoplay 限制（首次交互后重试）以及与全局 mute 状态同步。

// Plays looping background music for a page.
// Notes:
// - Most browsers block autoplay until the user interacts; we try immediately and
//   then retry once on first pointerdown/keydown.
// - The music respects the global mute toggle via `useSoundStore`.
export default function useBackgroundMusic({ enabled = true, volume = 0.22 } = {}) {
	const muted = useSoundStore((state) => state.muted)

	useEffect(() => {
		// Page-level lifecycle: enable BGM + autoplay-retry while this page is active.
		if (!enabled) {
			pauseBackgroundMusic()
			disableBackgroundMusicAutoplayRetry()
			return
		}

		setBackgroundMusicVolume(volume)
		enableBackgroundMusicAutoplayRetry()
		startBackgroundMusic()

		return () => {
			pauseBackgroundMusic()
			disableBackgroundMusicAutoplayRetry()
		}
	}, [enabled, volume])

	useEffect(() => {
		if (!enabled) return
		// Keep playback state aligned with the global mute toggle.
		syncBackgroundMusicWithMute(muted)
	}, [enabled, muted])
}
