import BaseModal from "../ui/BaseModal"

export default function ExitGameModal({ open, onCancel, onConfirm }) {
	return (
		<BaseModal
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onCancel()
			}}
		>
			<div className="w-[384px] max-w-[calc(100vw-2rem)] rounded-[24px] bg-white p-8 shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
				<h2 className="text-[24px] font-bold leading-8 text-[#1d293d]">Exit Game?</h2>
				<p className="mt-2 text-[16px] font-medium leading-6 text-[#62748e]">
					Are you sure you want to exit? The game is currently in progress.
				</p>

				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="h-12 flex-1 cursor-pointer rounded-[14px] bg-[#f1f5f9] text-[16px] font-bold leading-6 text-[#45556c] transition-colors hover:bg-[#e2e8f0]"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="h-12 flex-1 cursor-pointer rounded-[14px] bg-[#fb2c36] text-[16px] font-bold leading-6 text-white shadow-[0px_4px_0px_0px_#b91c1c] transition-[filter] hover:brightness-95"
					>
						Yes, Exit
					</button>
				</div>
			</div>
		</BaseModal>
	)
}
