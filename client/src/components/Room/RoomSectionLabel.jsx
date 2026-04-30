import { Crown } from "lucide-react"
import { cn } from "../../lib/utils"

export default function RoomSectionLabel({ isHost, className }) {
	return (
		<div
			className={cn(
				"flex items-center justify-center gap-2 text-xs font-semibold tracking-normal text-primary",
				className,
			)}
		>
			<Crown className="size-4" />
			<span className="uppercase">{isHost ? "Owner settings:" : "Room settings:"}</span>
		</div>
	)
}
