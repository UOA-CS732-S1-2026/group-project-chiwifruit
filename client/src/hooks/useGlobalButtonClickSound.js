import { useEffect } from "react"

import { playClickSfx } from "../lib/sound"

// NOTE (2026-04-29): Use a capture-phase click listener to provide consistent
// click feedback across buttons in the app.
// `data-skip-click-sfx`, `disabled`, and `aria-disabled` prevent misleading audio.

// Plays a click sound whenever the user clicks a button.
// Uses a capture-phase listener so it works even if components stop propagation.
// Filters out disabled buttons to avoid misleading feedback.
export default function useGlobalButtonClickSound() {
	useEffect(() => {
		// Helper: play the button click sound only for interactive button-like targets.
		const handler = (event) => {
			const target = event.target
			if (!(target instanceof Element)) return

			const button = target.closest('button, [role="button"]')
			if (!button) return
			if (button.getAttribute("data-skip-click-sfx") === "true") return
			if (button instanceof HTMLButtonElement && button.disabled) return
			if (button.getAttribute("aria-disabled") === "true") return

			playClickSfx()
		}

		document.addEventListener("click", handler, true)
		return () => document.removeEventListener("click", handler, true)
	}, [])
}
