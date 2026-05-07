import GameToast from "./GameToast"

export default function GameStatusBroadcast({
	phase,
	players,
	currentTurnIndex,
	turnSeconds,
	inputCount,
	requiredInputCount,
	sequenceLength,
	autoPlayIndex,
	padCount,
	freePlaySeconds,
	isSpectating,
	isMyTurn,
	fallbackMessage,
	className,
}) {
	const currentPlayerName = players[currentTurnIndex]?.name ?? "Player"

	let message = fallbackMessage ?? "Game status"

	if (phase === "familiarize:auto") {
		message = `Familiarize yourself with the notes: playing sound ${Math.min(autoPlayIndex + 1, padCount)} / ${padCount}.`
	}

	if (phase === "familiarize:free") {
		message = `Free play: try the notes. Match starts in ${freePlaySeconds}s.`
	}

	if (phase === "playing") {
		message =
			isMyTurn && !isSpectating
				? `Your turn: ${inputCount} / ${requiredInputCount} notes, ${turnSeconds}s left. Sequence length: ${sequenceLength}.`
				: `${currentPlayerName}'s turn: ${turnSeconds}s left. Sequence length: ${sequenceLength}.`
	}

	if (phase === "playing" && isSpectating) {
		message = `You're out! Spectating ${currentPlayerName}'s turn. Sequence length: ${sequenceLength}.`
	}

	return <GameToast message={message} className={className} />
}
