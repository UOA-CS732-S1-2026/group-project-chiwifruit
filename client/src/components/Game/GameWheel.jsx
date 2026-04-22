import { cn } from "../../lib/utils"

export default function GameWheel({
	pads,
	activePadIndex = null,
	disabled = false,
	onPadPress,
	className,
	centerContent,
}) {
	const count = pads.length

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
						disabled={disabled}
						onClick={() => onPadPress?.(index)}
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
