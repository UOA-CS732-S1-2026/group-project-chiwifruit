import { cn } from "../../lib/utils"

export default function RoomPill({ children, className }) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm",
				className,
			)}
		>
			{children}
		</div>
	)
}
