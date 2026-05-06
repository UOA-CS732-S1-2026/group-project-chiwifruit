export default function RoomFullErrorMessage() {
	return (
		<div
			role="alert"
			className="
				inline-flex max-w-[28rem] items-start gap-3 rounded-2xl
				border border-red-200/80 bg-rose-50 px-4 py-3.5
				text-red-600 shadow-[0_8px_24px_rgba(239,68,68,0.12)]
			"
		>
			<span
				aria-hidden="true"
				className="
					mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center
					rounded-full bg-red-600 text-[0.75rem] font-bold leading-none text-white
				"
			>
				!
			</span>

			<p className="text-sm font-medium leading-6">
				This room is already full! You can create a new room instead.
			</p>
		</div>
	)
}
