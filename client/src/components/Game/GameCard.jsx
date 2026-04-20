import { cn } from "../../lib/utils"

export default function GameCard({ className, children }) {
	return (
		<div
			className={cn(
				"rounded-3xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur-sm",
				className,
			)}
		>
			{children}
		</div>
	)
}
