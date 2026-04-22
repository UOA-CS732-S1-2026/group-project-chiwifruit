import * as React from "react"
import { createPortal } from "react-dom"

function useLockBodyScroll(locked) {
	React.useEffect(() => {
		if (!locked) return

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"

		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [locked])
}

export default function BaseModal({
	open,
	onOpenChange,
	children,
	closeOnBackdropClick = false,
	overlayClassName = "bg-[#0F172B66]",
}) {
	useLockBodyScroll(open)

	React.useEffect(() => {
		if (!open) return
		if (!onOpenChange) return

		const handleKeyDown = (event) => {
			if (event.key !== "Escape") return
			onOpenChange(false)
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [onOpenChange, open])

	if (!open) return null

	return createPortal(
		<div
			className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}
			onMouseDown={(event) => {
				if (!closeOnBackdropClick) return
				if (!onOpenChange) return
				if (event.target !== event.currentTarget) return
				onOpenChange(false)
			}}
		>
			<div role="dialog" aria-modal="true">
				{children}
			</div>
		</div>,
		document.body,
	)
}
