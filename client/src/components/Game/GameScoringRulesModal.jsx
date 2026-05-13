import { X } from "lucide-react"
import BaseModal from "../ui/BaseModal"

export default function GameScoringRulesModal({ open, onOpenChange }) {
	return (
		<BaseModal open={open} onOpenChange={onOpenChange}>
			<div className="relative w-[560px] max-w-[calc(100vw-32px)] rounded-[24px] bg-white shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
				<button
					type="button"
					onClick={() => onOpenChange?.(false)}
					className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-[#62748e] transition-colors hover:bg-[#f1f5f9] hover:text-[#091149] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5eed]/40"
					aria-label="Close"
				>
					<X className="size-5" />
				</button>

				<div className="px-8 pb-8 pt-8">
					<h2 className="text-[24px] font-bold leading-8 text-[#091149]">Scoring Rules</h2>
					<ul className="mt-4 space-y-3 text-[16px] font-medium leading-7 text-[#475569]">
						<li>- Earn +1 point for each note you successfully replicate.</li>
						<li>- The first player in Round 1 does not score for their first note, because there is no note to replicate yet.</li>
						<li>
							- If you only replicate some notes correctly, you still get points for the
							correct ones.
						</li>
						<li>
							- After each full round, surviving players get a bonus:
						</li>
						<li> activePlayers &times; roundCount - 1</li>
						<li>- If no one plays before timeout, everyone gets 0 points and ranking follows room order.</li>
					</ul>
				</div>
			</div>
		</BaseModal>
	)
}
