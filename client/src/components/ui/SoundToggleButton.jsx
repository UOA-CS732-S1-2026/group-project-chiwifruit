import { Volume2, VolumeX } from "lucide-react"

import useSoundStore from "../../store/useSoundStore"
import { Button } from "./button"

// NOTE (2026-04-29): 这是全局 mute 开关，影响：背景音乐 + 点击音效。
// data-skip-click-sfx 用来避免“点击按钮 -> 又播放点击音”叠加到某些交互上。

// Global sound toggle (mute/unmute) used in page headers.
// Muting affects both background music and click SFX.
export default function SoundToggleButton({ className } = {}) {
	const muted = useSoundStore((state) => state.muted)
	const toggleMuted = useSoundStore((state) => state.toggleMuted)

	return (
		<Button
			type="button"
			variant="outline"
			size="icon-lg"
			onClick={toggleMuted}
			data-skip-click-sfx="true"
			className={
				"cursor-pointer rounded-2xl bg-card shadow-sm transition-colors hover:bg-muted hover:shadow-md active:scale-[0.98] " +
				(className ?? "")
			}
			aria-label={muted ? "Unmute" : "Mute"}
			title={muted ? "Unmute" : "Mute"}
		>
			{muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
		</Button>
	)
}
