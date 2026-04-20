import { Button } from "../ui/button"

export default function ReadyBar({ onStart }) {
	return (
		<div className="rounded-2xl border border-sky-200/70 bg-sky-50 px-5 py-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-sm font-extrabold text-sky-900">Ready to Start?</p>
					<p className="text-sm text-sky-800">Click Start Match Now, or wait for the timer to auto-start</p>
				</div>
				<Button
					onClick={onStart}
					className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-white hover:bg-foreground/90"
				>
					Start Match Now
				</Button>
			</div>
		</div>
	)
}
