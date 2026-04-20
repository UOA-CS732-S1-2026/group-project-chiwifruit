import { cn } from "../../lib/utils"

import GameCard from "./GameCard"

function PlayerRow({ name, alive, isHost, HostIcon }) {
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("")

	return (
		<div className="flex items-center justify-between gap-3 py-3">
			<div className="flex min-w-0 items-center gap-3">
				<div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-foreground">
					{initials || "?"}
				</div>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="truncate text-sm font-semibold text-foreground">{name}</p>
						{isHost ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-foreground">
								{HostIcon ? <HostIcon className="size-3.5" /> : null}
								Host
							</span>
						) : null}
					</div>
					<span
						className={cn(
							"mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
							alive ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
						)}
					>
						{alive ? "Alive" : "Out"}
					</span>
				</div>
			</div>
		</div>
	)
}

export default function PlayersPanel({ title, subtitle, players, hostIcon: HostIcon, className }) {
	return (
		<GameCard className={cn("p-5", className)}>
			<div>
				<h2 className="hero-title text-lg font-extrabold tracking-[-0.02em]">{title}</h2>
				<p className="text-muted-theme mt-1 text-sm">{subtitle}</p>
			</div>
+
			<div className="mt-4 divide-y divide-border">
				{players.map((player) => (
					<PlayerRow key={player.id} {...player} HostIcon={HostIcon} />
				))}
			</div>
		</GameCard>
	)
}
