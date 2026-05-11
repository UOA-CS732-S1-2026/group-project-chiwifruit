import { CircleAlert, Volume2 } from "lucide-react"

import { cn } from "../../lib/utils"

export default function GameStatusBroadcast({
	phase,
	players = [],
	currentTurnIndex = 0,
	inputCount = 0,
	sequenceLength = 0,
	isSpectating = false,
	isMyTurn = false,
	status,
	actorName,
	currentUserName,
	fallbackMessage,
	className,
}) {
	const currentPlayerName = players[currentTurnIndex]?.name ?? "Player"
	const displayName = actorName ?? currentPlayerName
	const outPlayerName = actorName ?? currentUserName ?? currentPlayerName
	let message = fallbackMessage ?? "Familiarize yourself with the notes!"
	let variant = "default"

	if (status === "out" || isSpectating) {
		message = `${outPlayerName} is OUT! Pressed the wrong note!`
		variant = "danger"
	}

	if (status === "turn-over") {
		message = `${displayName} added a note! Turn over.`
	}

	if (status === "listen") {
		message = "Listen to the buttons..."
	}

	if (!status && !isSpectating && (phase === "familiarize:auto" || phase === "familiarize:free" || phase === "familiarize:waiting")) {
		message = "Familiarize yourself with the notes!"
	}

	if (!status && !isSpectating && phase === "playing") {
		if (isMyTurn && sequenceLength === 0 && inputCount === 0) {
			message = "Game started! You go first. Press any note."
		} else if (isMyTurn && inputCount < sequenceLength) {
			message = "Listen to the buttons..."
		} else if (!isMyTurn) {
			message = `${currentPlayerName}'s turn! Watch and repeat.`
		}
	}

	if (!message) return null

	const isDanger = variant === "danger"
	const Icon = isDanger ? CircleAlert : Volume2

	return (
		<div className={cn("flex justify-center", className)}>
			<div className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white shadow-lg">
				<Icon className={cn("size-4 shrink-0", isDanger ? "text-[#ff5a5f]" : "text-[#2dd4bf]")} />
				{message}
			</div>
		</div>
	)
}
