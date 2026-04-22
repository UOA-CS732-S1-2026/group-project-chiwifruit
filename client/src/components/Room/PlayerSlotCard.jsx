import { Crown, UserRound } from "lucide-react"
import { cn } from "../../lib/utils"
import PlayerReadyChip from "./PlayerReadyChip"

function AvatarCircle({ avatarUrl, avatarAlt = "Player avatar", fallback }) {
	return (
		<div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-full bg-muted">
			{avatarUrl ? (
				<img src={avatarUrl} alt={avatarAlt} className="h-full w-full object-cover" />
			) : fallback ? (
				<span className="text-4xl leading-none">{fallback}</span>
			) : (
				<UserRound className="size-7 text-muted-foreground" />
			)}
		</div>
	)
}

export default function PlayerSlotCard({
	player,
	isCurrentUser = false,
	className,
}) {
	if (player.isEmpty) {
		return (
			<div
				className={cn(
					"relative min-h-40 rounded-3xl border-2 border-dashed border-border bg-card p-6 text-center shadow-sm",
					className,
				)}
			>
				<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
					<div className="grid size-12 place-items-center rounded-full bg-muted/70">
						<UserRound className="size-6" />
					</div>
					<span className="text-sm font-semibold">Waiting...</span>
				</div>
			</div>
		)
	}

	return (
		<div
			className={cn(
				"relative min-h-40 rounded-3xl border-2 bg-card p-6 text-center shadow-sm transition",
				isCurrentUser
					? "border-emerald-400"
					: player.isHost
						? "border-primary"
						: "border-border",
				className,
			)}
		>
			{player.isHost ? (
				<div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 p-1.5 shadow ring-2 ring-white">
					<Crown className="size-4 text-white" />
				</div>
			) : null}

			<AvatarCircle avatarUrl={player.avatarUrl} fallback={player.avatar} />

			<p className="mt-3 text-sm font-semibold text-foreground">{player.username}</p>

			{player.isHost ? (
				<span className="mt-1 block text-[11px] font-semibold uppercase text-primary">
					Room Owner
				</span>
			) : null}

			{player.isHost ? null : (
				<div className="mt-3">
					<PlayerReadyChip isReady={player.isReady} />
				</div>
			)}
		</div>
	)
}
