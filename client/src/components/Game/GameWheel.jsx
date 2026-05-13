import { cn } from "../../lib/utils"
import GamePadRipple from "./GamePadRipple"

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
	const padOrbitRadius = count === 10 ? 36 : count === 8 ? 34 : 32
	const padSizePercent = count === 10 ? 16 : count === 8 ? 18 : 20

	return (
		<div
			className={cn(
				"game-wheel relative mx-auto aspect-square w-full max-w-[26.25rem] sm:w-[26.25rem]",
				className,
			)}
		>
			<div className="game-wheel-ring absolute inset-0 rounded-full" />
			<div className="game-wheel-inner absolute inset-4 rounded-full" />

			{pads.map((pad, index) => {
				const angle = (2 * Math.PI * index) / count - Math.PI / 2
				const x = Math.cos(angle) * padOrbitRadius
				const y = Math.sin(angle) * padOrbitRadius

				return (
					<div
						key={`${pad.base}-${index}`}
						className="absolute left-0 top-0 aspect-square -translate-x-1/2 -translate-y-1/2 overflow-visible"
						style={{
							left: `calc(50% + ${x}%)`,
							top: `calc(50% + ${y}%)`,
							width: `${padSizePercent}%`,
							height: `${padSizePercent}%`,
							"--pad-base": pad.base,
							"--pad-highlight": pad.highlight,
							"--pad-shadow": pad.shadow,
							"--pad-glow": pad.glow,
						}}
					>
						<span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-full w-full -translate-x-1/2 -translate-y-1/2 overflow-visible">
							<GamePadRipple active={activePadIndex === index} />
						</span>

						<button
							type="button"
							data-skip-click-sfx="true"
							disabled={disabled}
							onClick={() => onPadPress?.(index)}
							className={cn(
								"game-pad absolute z-10",
								disabled ? "cursor-default" : "cursor-pointer",
								activePadIndex === index ? "is-active" : "",
							)}
							style={{
								left: "50%",
								top: "50%",
								width: "100%",
								height: "100%",
							}}
							aria-label={`Sound pad ${index + 1}`}
						/>
					</div>
				)
			})}

			<div className="game-wheel-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
				<div className="game-wheel-center-content">{centerContent}</div>
			</div>
		</div>
	)
}
