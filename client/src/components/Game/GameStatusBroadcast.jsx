import { CircleAlert, Volume2 } from "lucide-react"

import { cn } from "../../lib/utils"

// Component: resolve the current game-phase/status message into the compact
// broadcast banner shown above the wheel.
export default function GameStatusBroadcast({
	phase,
	players = [],
	currentTurnIndex = 0,
	inputCount = 0,
	sequenceLength = 0,
	isMyTurn = false,
	status,
	actorName,
	reason,
	currentUserName,
	className,
}) {
	// Derived state: fall back to the current turn player when no explicit actor is supplied.
	const currentPlayerName = players[currentTurnIndex]?.name ?? "Player"
	const displayName = actorName ?? currentPlayerName
	let message = ""
	let variant = "default"

	if (status === "out-self") {
		message = reason === "timeout" ? "Time out!" : "Pressed the wrong note!"
		variant = "danger"
	}

	if (status === "out-other") {
		message = `${displayName} is out! ${reason === "timeout" ? "(time out)" : "(Press a wrong note)"}`
		variant = "danger"
	}

	if (status === "turn-over") {
		message = `${displayName} added a note! Turn over.`
	}

	if (status === "familiar-listen") {
		message = "Listen to the buttons..."
	}

	if (status === "familiar-practice") {
		message = "Now it's your turn to practice!"
	}

	if (status === "repeat-self") {
		message = "Your turn! Watch and repeat."
	}

	if (status === "repeat-complete-self") {
		message = `${currentUserName ?? currentPlayerName} repeated correctly! Now add a note.`
	}

	if (status === "watch-other") {
		message = `${currentPlayerName}'s turn. Watch and listen.`
	}

	if (!status && phase === "familiarize:auto") {
		message = "Listen to the buttons..."
	}

	if (!status && phase === "familiarize:free") {
		message = "Now it's your turn to practice!"
	}

	if (!status && phase === "familiarize:waiting") {
		message = "Waiting for other players to get ready..."
	}

	if (!status && phase === "playing") {
		if (isMyTurn && sequenceLength === 0 && inputCount === 0) {
			message = "Game started! You go first. Press any note."
		} else if (isMyTurn && inputCount >= sequenceLength && sequenceLength > 0) {
			message = `${currentUserName ?? currentPlayerName} repeated correctly! Now add a note.`
		} else if (isMyTurn && inputCount < sequenceLength) {
			message = "Your turn! Watch and repeat."
		} else if (!isMyTurn) {
			message = `${currentPlayerName}'s turn. Watch and listen.`
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
