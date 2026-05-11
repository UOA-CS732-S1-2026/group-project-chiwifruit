import * as React from "react"
import { motion } from "framer-motion"

const MotionSpan = motion.span

const rippleRings = [
	{ delay: 0, duration: 0.52, sizeClassName: "h-[92%] w-[92%]", peakOpacity: 0.78, borderWidth: 2 },
	{ delay: 0.08, duration: 0.6, sizeClassName: "h-[118%] w-[118%]", peakOpacity: 0.56, borderWidth: 2 },
	{ delay: 0.16, duration: 0.68, sizeClassName: "h-[146%] w-[146%]", peakOpacity: 0.36, borderWidth: 1.5 },
]

const RIPPLE_LIFETIME_MS = Math.ceil(
	Math.max(0.62, ...rippleRings.map((ring) => ring.delay + ring.duration)) * 1000 + 60,
)

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
					<MotionSpan
						className="
							game-pad-ripple-pulse absolute left-1/2 top-1/2 h-[66%] w-[66%] -translate-x-1/2 -translate-y-1/2
							rounded-full border border-white/55
						"
						style={{
							background: "radial-gradient(circle, color-mix(in srgb, var(--pad-highlight) 72%, white 28%) 0%, color-mix(in srgb, var(--pad-base) 70%, transparent) 62%, transparent 100%)",
							boxShadow: "0 0 26px var(--pad-glow), inset 0 0 18px rgba(255,255,255,0.22)",
						}}
						initial={{ scale: 0.68, opacity: 0.92, filter: "blur(0px)" }}
						animate={{ scale: 1.42, opacity: 0, filter: "blur(2px)" }}
						transition={{ duration: 0.62, ease: [0.16, 0.84, 0.32, 1] }}
					/>

					{rippleRings.map((ring) => (
						<MotionSpan
							key={`${pulseId}-${ring.delay}`}
							className={[
								"game-pad-ripple-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
								ring.sizeClassName,
							].join(" ")}
							style={{
								borderColor: "color-mix(in srgb, var(--pad-base) 72%, white 28%)",
								boxShadow: "0 0 18px var(--pad-glow), inset 0 0 12px var(--pad-glow)",
								borderWidth: `${ring.borderWidth}px`,
							}}
							initial={{ scale: 0.62, opacity: 0 }}
							animate={{ scale: 1.56, opacity: [0, ring.peakOpacity, 0] }}
							transition={{
								duration: ring.duration,
								delay: ring.delay,
								ease: [0.16, 0.84, 0.32, 1],
								times: [0, 0.2, 1],
							}}
						/>
					))}
				</span>
			))}
		</span>
	)
}
