import * as React from "react"
import { createPortal } from "react-dom"

// NOTE (2026-04-29): 用“引用计数”方式锁定 body 滚动。
// 原因：页面可能出现多个 modal 叠加（例如 YoureOut + Results）。如果每个 modal
// 都在 unmount 时直接把 overflow 还原，顺序一旦错就会导致页面永久无法滚动。
let bodyScrollLockCount = 0
let bodyScrollPrevOverflow = ""

function lockBodyScroll() {
	if (typeof document === "undefined") return
	if (bodyScrollLockCount === 0) {
		bodyScrollPrevOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
	}
	bodyScrollLockCount += 1
}

function unlockBodyScroll() {
	if (typeof document === "undefined") return
	if (bodyScrollLockCount <= 0) return
	bodyScrollLockCount -= 1
	if (bodyScrollLockCount === 0) {
		document.body.style.overflow = bodyScrollPrevOverflow
		bodyScrollPrevOverflow = ""
	}
}

// Shared modal foundation used across the app.
// - Renders into a portal at document.body to avoid z-index/stacking issues.
// - Locks body scroll when open.
// - Supports optional Escape-to-close and optional backdrop-click-to-close.
function useLockBodyScroll(locked) {
	React.useEffect(() => {
		if (!locked) return
		lockBodyScroll()
		return () => unlockBodyScroll()
	}, [locked])
}

export default function BaseModal({
	open,
	onOpenChange,
	children,
	closeOnBackdropClick = false,
	overlayClassName = "bg-[#0F172B66]",
}) {
	// Prevent background scrolling while a modal is open.
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
				// Only close when the *backdrop itself* is clicked (not inner content).
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
