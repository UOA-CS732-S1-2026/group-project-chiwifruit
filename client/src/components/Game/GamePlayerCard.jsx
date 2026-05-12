import { cn } from "../../lib/utils"

export default function GamePlayerCard({
	name,
	avatarUrl,
	status = "WAITING",
	score = 0,
	isCurrentTurn = false,
	turnSeconds,
	className,
}) {
	const isEliminated = status === "OUT OF GAME" || status === "ELIMINATED"
	const displayStatus = isEliminated ? "ELIMINATED" : status

	return (
		<div
			className={cn(
				"flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm",
				isCurrentTurn ? "border-[#00D5BE] ring-2 ring-[#00D5BE]/20" : "",
				isEliminated ? "border-[#96F7E4]/50 bg-[#96F7E4]/10 opacity-60" : "",
				className,
			)}
		>
			<div className="flex min-w-0 items-center gap-3">
				<div className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted", isEliminated ? "opacity-70" : "")}>
					{avatarUrl ? (
						<img src={avatarUrl} alt="Player avatar" className="h-full w-full object-cover" />
					) : (
						<div className="size-8 rounded-full bg-muted-foreground/20" />
					)}
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-extrabold text-foreground">{name}</p>
					<p className={cn("mt-0.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase", isCurrentTurn ? "text-[#00BBA7]" : "", isEliminated ? "text-red-500" : "")}
					>
						{isCurrentTurn ? "CURRENT TURN" : displayStatus}
					</p>
					<p className="mt-1 text-sm font-semibold text-foreground">
						<span className="text-muted-foreground">Score:</span> {score}
					</p>
				</div>
			</div>

			{isCurrentTurn && typeof turnSeconds === "number" ? (
				<div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#00BBA7] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(0,187,167,0.35)]">
					{turnSeconds}
				</div>
			) : null}
		</div>
	)
}
