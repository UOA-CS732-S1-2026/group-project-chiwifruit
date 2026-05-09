import * as React from "react"

const RIPPLE_LIFETIME_MS = 720

const rippleRings = [
	{ delay: "0ms", duration: "520ms", sizeClassName: "h-[72%] w-[72%]", opacity: 0.7 },
	{ delay: "80ms", duration: "600ms", sizeClassName: "h-[90%] w-[90%]", opacity: 0.48 },
	{ delay: "160ms", duration: "680ms", sizeClassName: "h-[108%] w-[108%]", opacity: 0.3 },
]

export default function GamePadRipple({ active = false }) {
	const [pulseIds, setPulseIds] = React.useState([])
	const wasActiveRef = React.useRef(false)
	const timeoutIdsRef = React.useRef(new Set())

	React.useEffect(() => {
		const timeoutIds = timeoutIdsRef.current

		return () => {
			timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
			timeoutIds.clear()
		}
	}, [])

	React.useEffect(() => {
		if (!active) {
			wasActiveRef.current = false
			return
		}

		if (wasActiveRef.current) return

		const id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
		wasActiveRef.current = true
		setPulseIds((current) => [...current, id])

		const timeoutId = window.setTimeout(() => {
			setPulseIds((current) => current.filter((pulseId) => pulseId !== id))
			timeoutIdsRef.current.delete(timeoutId)
		}, RIPPLE_LIFETIME_MS)

		timeoutIdsRef.current.add(timeoutId)
	}, [active])

	if (pulseIds.length === 0) return null

	return (
		<span
			aria-hidden="true"
			className="game-pad-ripple-layer pointer-events-none absolute inset-0 z-0"
		>
			{pulseIds.map((pulseId) => (
				<span key={pulseId} className="pointer-events-none absolute inset-0">
					<span
						className="
							game-pad-ripple-pulse absolute left-1/2 top-1/2 h-[54%] w-[54%]
							rounded-full border border-white/55
						"
						style={{
							background: "radial-gradient(circle, color-mix(in srgb, var(--pad-highlight) 72%, white 28%) 0%, color-mix(in srgb, var(--pad-base) 70%, transparent) 62%, transparent 100%)",
							boxShadow: "0 0 26px var(--pad-glow), inset 0 0 18px rgba(255,255,255,0.22)",
							animation: "game-pad-ripple-glow 620ms ease-out both",
						}}
					/>

					{rippleRings.map((ring) => (
						<span
							key={`${pulseId}-${ring.delay}`}
							className={[
								"game-pad-ripple-pulse absolute left-1/2 top-1/2 rounded-full border",
								ring.sizeClassName,
							].join(" ")}
							style={{
								borderColor: "color-mix(in srgb, var(--pad-base) 72%, white 28%)",
								boxShadow: "0 0 18px var(--pad-glow), inset 0 0 12px var(--pad-glow)",
								opacity: ring.opacity,
								animationName: "game-pad-ripple-wave",
								animationDuration: ring.duration,
								animationTimingFunction: "cubic-bezier(0.16, 0.84, 0.32, 1)",
								animationDelay: ring.delay,
								animationFillMode: "both",
							}}
						/>
					))}
				</span>
			))}
		</span>
	)
}
