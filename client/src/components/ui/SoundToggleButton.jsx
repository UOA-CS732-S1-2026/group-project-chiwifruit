import { Volume2, VolumeX } from "lucide-react"

import useSoundStore from "../../store/useSoundStore"
import { Button } from "./button"

export default function SoundToggleButton({ className } = {}) {
	const muted = useSoundStore((state) => state.muted)
	const toggleMuted = useSoundStore((state) => state.toggleMuted)

	return (
		<Button
			type="button"
			variant="outline"
			size="icon-lg"
			onClick={toggleMuted}
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
