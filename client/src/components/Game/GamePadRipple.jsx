const rippleRings = [
	{
		delay: "0ms",
		duration: "900ms",
		sizeClassName: "h-7 w-7",
		ringClassName: "border-white/75 shadow-[0_0_14px_rgba(255,255,255,0.18)]",
	},
	{
		delay: "140ms",
		duration: "980ms",
		sizeClassName: "h-8 w-8",
		ringClassName: "border-white/55 shadow-[0_0_12px_rgba(255,255,255,0.12)]",
	},
	{
		delay: "280ms",
		duration: "1060ms",
		sizeClassName: "h-9 w-9",
		ringClassName: "border-white/35 shadow-[0_0_10px_rgba(255,255,255,0.08)]",
	},
]

export default function GamePadRipple({ active = false }) {
	if (!active) return null

	return (
		<span aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
			<span
				className="
					absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2
					rounded-full bg-white/20 blur-[3px]
					animate-[game-pad-ripple-core_700ms_ease-out_forwards]
				"
			/>

			{rippleRings.map((ring) => (
				<span
					key={ring.delay}
					className={[
						"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
						ring.sizeClassName,
						ring.ringClassName,
					].join(" ")}
					style={{
						animationName: "game-pad-ripple",
						animationDuration: ring.duration,
						animationTimingFunction: "cubic-bezier(0.16, 0.84, 0.32, 1)",
						animationDelay: ring.delay,
						animationFillMode: "forwards",
					}}
				/>
			))}
		</span>
	)
}
