import GameStatusBroadcast from "./GameStatusBroadcast"

export default function GameStatusBroadcastSection({
	phase,
	players,
	currentTurnIndex,
	turnSeconds,
	inputCount,
	requiredInputCount,
	sequence,
	autoPlayIndex,
	padCount,
	freePlaySeconds,
	isSpectating,
	currentUserId,
	toastMessage,
	className,
}) {
	return (
		<GameStatusBroadcast
			phase={phase}
			players={players}
			currentTurnIndex={currentTurnIndex}
			turnSeconds={turnSeconds}
			inputCount={inputCount}
			requiredInputCount={requiredInputCount}
			sequenceLength={sequence.length}
			autoPlayIndex={autoPlayIndex}
			padCount={padCount}
			freePlaySeconds={freePlaySeconds}
			isSpectating={isSpectating}
			isMyTurn={Boolean(currentUserId) && players[currentTurnIndex]?.id === currentUserId}
			fallbackMessage={toastMessage}
			className={className}
		/>
	)
}
