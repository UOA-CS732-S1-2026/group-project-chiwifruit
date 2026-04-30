import { ArrowRightFromLine, Play, TriangleAlert } from "lucide-react"

import BaseModal from "../ui/BaseModal"

export default function YoureOutModal({ open, onKeepSpectating, onBackToWaitingRoom }) {
	return (
		<BaseModal
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onKeepSpectating()
			}}
		>
			<div className="w-[448px] max-w-[calc(100vw-2rem)] rounded-[24px] bg-white px-8 pb-8 pt-8 text-center shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
				<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#ffe2e2] shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)]">
					<TriangleAlert className="size-8 text-[#fb2c36]" />
				</div>

				<h2 className="mt-6 text-[30px] font-bold leading-9 tracking-[-0.75px] text-[#1d293d]">You're Out!</h2>
				<p className="mt-3 text-[16px] font-medium leading-6 text-[#62748e]">
					Oh no, you made a mistake! But the game is still going. What would you like to do?
				</p>

				<div className="mt-8 flex flex-col gap-3">
					<button
						type="button"
						onClick={onKeepSpectating}
						className="relative flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-[16px] bg-[#00bba7] text-[18px] font-bold leading-7 text-white shadow-[0px_4px_0px_0px_#0d9488] transition-[filter] hover:brightness-95"
					>
						<Play className="size-5 fill-current" />
						<span>Keep Spectating</span>
					</button>

					<button
						type="button"
						onClick={onBackToWaitingRoom}
						className="relative flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-[16px] bg-[#f1f5f9] text-[16px] font-bold leading-6 text-[#45556c] transition-colors hover:bg-[#e2e8f0]"
					>
						<ArrowRightFromLine className="size-5" />
						<span>Back to Waiting Room</span>
					</button>
				</div>
			</div>
		</BaseModal>
	)
}
