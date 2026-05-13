import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

// Component: compact readiness badge used in room player cards.
export default function PlayerReadyChip({ isReady, className }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
				isReady ? "ready-gradient-theme ready-shadow-theme" : "bg-muted text-muted-foreground",
				className,
			)}
		>
			{isReady ? <Check className="size-3.5" /> : null}
			{isReady ? "Ready" : "Not Ready"}
		</span>
	)
}
