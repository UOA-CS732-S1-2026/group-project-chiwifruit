import { useEffect } from "react"

import { playClickSfx } from "../lib/sound"

// NOTE (2026-04-29): 用 capture 阶段全局监听 click 来补齐“所有按钮都有点击反馈音”。
// 通过 data-skip-click-sfx + disabled/aria-disabled 过滤，避免不该响的地方响。

// Plays a click sound whenever the user clicks a button.
// Uses a capture-phase listener so it works even if components stop propagation.
// Filters out disabled buttons to avoid misleading feedback.
export default function useGlobalButtonClickSound() {
	useEffect(() => {
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
