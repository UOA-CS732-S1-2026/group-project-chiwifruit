import { cn } from "../../lib/utils"
import { useRef } from "react"

// NOTE (2026-04-29): GameWheel 只负责渲染/布局与点击事件。
// 视觉主题（颜色/阴影/高亮）通过 CSS variables 注入，避免在 JS 里写死样式逻辑。

export default function GameWheel({
	pads,
	activePadIndex = null,
	disabled = false,
	onPadPress,
	className,
	centerContent,
}) {
	const count = pads.length
	const padRefs = useRef([])

	// Convert hex color to rgba with custom alpha
	const hexToRgba = (hex, alpha) => {
		const r = parseInt(hex.slice(1, 3), 16)
		const g = parseInt(hex.slice(3, 5), 16)
		const b = parseInt(hex.slice(5, 7), 16)
		return `rgba(${r}, ${g}, ${b}, ${alpha})`
	}

	// Create ripple effect from click position
	const createRipple = (e, index) => {
		const button = padRefs.current[index]
		if (!button) return

		const pad = pads[index]
		// Use button highlight color with 35% opacity for ripple
		const rippleColor = hexToRgba(pad.highlight, 0.35)

		const rect = button.getBoundingClientRect()
		const size = Math.max(rect.width, rect.height)
		const x = e.clientX - rect.left - size / 2
		const y = e.clientY - rect.top - size / 2

		const ripple = document.createElement('span')
		ripple.classList.add('pad-ripple')
		ripple.style.width = size + 'px'
		ripple.style.height = size + 'px'
		ripple.style.left = x + 'px'
		ripple.style.top = y + 'px'
		ripple.style.backgroundColor = rippleColor

		button.appendChild(ripple)

		setTimeout(() => ripple.remove(), 650)
	}

	const handlePadClick = (index, e) => {
		if (!disabled) {
			createRipple(e, index)
		}
		onPadPress?.(index)
	}

	return (
		<div className={cn("game-wheel relative mx-auto aspect-square w-full max-w-[26.25rem]", className)}>
			<div className="game-wheel-ring absolute inset-0 rounded-full" />
			<div className="game-wheel-inner absolute inset-[10%] rounded-full" />

			{pads.map((pad, index) => {
				const angle = (2 * Math.PI * index) / count - Math.PI / 2
				const radius = 32 // percent of container half-size
				const x = Math.cos(angle) * radius
				const y = Math.sin(angle) * radius

				return (
					<button
						key={`${pad.base}-${index}`}
						type="button"
						data-skip-click-sfx="true"
						disabled={disabled}
						ref={(el) => (padRefs.current[index] = el)}
						onClick={(e) => handlePadClick(index, e)}
						className={cn(
							"game-pad absolute",
							disabled ? "cursor-default" : "cursor-pointer",
							activePadIndex === index ? "is-active" : "",
						)}
						style={{
							left: `calc(50% + ${x}%)`,
							top: `calc(50% + ${y}%)`,
							"--pad-base": pad.base,
							"--pad-highlight": pad.highlight,
							"--pad-shadow": pad.shadow,
							"--pad-glow": pad.glow,
						}}
						aria-label={`Sound pad ${index + 1}`}
					/>
				)
			})}
			<div className="game-wheel-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
				{centerContent}
			</div>
		</div>
	)
}
