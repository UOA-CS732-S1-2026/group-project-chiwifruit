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
	const displayStatus = status === "OUT OF GAME" ? "ELIMINATED" : status

	return (
		<div
			className={cn(
				"flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm",
				isCurrentTurn ? "border-emerald-300 ring-2 ring-emerald-200/40" : "",
				className,
			)}
		>
			<div className="flex min-w-0 items-center gap-3">
				<div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
					{avatarUrl ? (
						<img src={avatarUrl} alt="Player avatar" className="h-full w-full object-cover" />
					) : (
						<div className="size-8 rounded-full bg-muted-foreground/20" />
					)}
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-extrabold text-foreground">{name}</p>
					<p className={cn("mt-0.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase", isCurrentTurn ? "text-emerald-600" : "")}
					>
						{isCurrentTurn ? "CURRENT TURN" : displayStatus}
					</p>
					<p className="mt-1 text-sm font-semibold text-foreground">
						<span className="text-muted-foreground">Score:</span> {score}
					</p>
				</div>
			</div>

			{isCurrentTurn && typeof turnSeconds === "number" ? (
				<div className="grid size-11 shrink-0 place-items-center rounded-full ready-gradient-theme ready-shadow-theme text-sm font-extrabold">
					{turnSeconds}
				</div>
			) : null}
		</div>
	)
}
