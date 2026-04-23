import { useEffect } from "react"

import { playClickSfx } from "../lib/sound"

export default function useGlobalButtonClickSound() {
	useEffect(() => {
		const handler = (event) => {
			const target = event.target
			if (!(target instanceof Element)) return

			const button = target.closest('button, [role="button"]')
			if (!button) return
			if (button instanceof HTMLButtonElement && button.disabled) return
			if (button.getAttribute("aria-disabled") === "true") return

			playClickSfx()
		}

		document.addEventListener("click", handler, true)
		return () => document.removeEventListener("click", handler, true)
	}, [])
}
