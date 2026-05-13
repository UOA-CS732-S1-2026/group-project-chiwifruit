import { useEffect } from "react"
import { CircleAlert } from "lucide-react"

import { cn } from "../../lib/utils"

const DEFAULT_DURATION = 5000

export default function ErrorToast({ message, duration = DEFAULT_DURATION, onDismiss, className }) {
	useEffect(() => {
		if (!message) return
		if (!onDismiss) return

		const timeoutId = window.setTimeout(onDismiss, duration)
		return () => window.clearTimeout(timeoutId)
	}, [duration, message, onDismiss])

	if (!message) return null

	return (
		<div
			className={cn(
				"pointer-events-none fixed left-1/2 top-5 z-[60] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 px-4",
				className,
			)}
			role="alert"
			aria-live="assertive"
		>
			<div className="mx-auto flex w-fit max-w-[26rem] items-start gap-3 rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-left text-sm font-semibold leading-5 text-[#dc2626] shadow-[0px_10px_24px_rgba(15,23,42,0.14)]">
				<CircleAlert className="mt-0.5 size-5 shrink-0 fill-[#dc2626] text-white" />
				<span>{message}</span>
			</div>
		</div>
	)
}
