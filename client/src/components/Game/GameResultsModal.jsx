import BaseModal from "../ui/BaseModal"
import GameResultsPanel from "./GameResultsPanel"

// NOTE (2026-05-03): This modal is now only a wrapper around the shared results
// panel. Finished-game UI is owned by GameFinishedPage / GamePage terminal state,
// so the ranking/buttons stay visually consistent no matter how the user reaches
// the finished route.
export default function GameResultsModal({ open, players, onBackToRoom, onBackToHome }) {
	return (
		<BaseModal open={open} onOpenChange={undefined} overlayClassName="bg-[#f1f5f9]">
			<GameResultsPanel players={players} onBackToRoom={onBackToRoom} onBackToHome={onBackToHome} />
		</BaseModal>
	)
}
