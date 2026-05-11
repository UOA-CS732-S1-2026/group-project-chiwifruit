import { Check, Play } from "lucide-react"

import { Button } from "../ui/button"

export default function WaitingRoomActionBar({
	isHost,
	canStartGame,
	currentUserReady,
	isReadyPending,
	onStartGame,
	onReady,
}) {
	return (
		<div
			className="fixed inset-x-0 bottom-0 z-50 flex justify-center border-t border-border/40 bg-transparent px-6 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.06)]"
			style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
		>
			{isHost ? (
				<Button
					type="button"
					onClick={onStartGame}
					disabled={!canStartGame}
					className="h-12 min-w-52 rounded-full px-12 text-base font-semibold shadow-lg"
				>
					<Play className="size-4 fill-current" />
					Start Game
				</Button>
			) : (
				<Button
					type="button"
					onClick={onReady}
					disabled={isReadyPending}
					variant={currentUserReady ? "default" : "outline"}
					className={
						currentUserReady
							? "h-12 min-w-52 rounded-full px-12 text-base font-semibold ready-gradient-theme ready-shadow-theme"
							: "h-12 min-w-52 rounded-full px-12 text-base font-semibold shadow-lg"
					}
				>
					{currentUserReady ? (
						<>
							<Check className="size-4" />
							Ready!
						</>
					) : (
						"Click to Ready"
					)}
				</Button>
			)}
		</div>
	)
}
