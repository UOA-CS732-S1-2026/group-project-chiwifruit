export default function Background({ children }) {
	return (
		<div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,_#f8f9ff_0%,_#eff3ff_45%,_#e9ecff_100%)]">
			<div className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-[color:var(--hero-glow-top)]/45 blur-[7.5rem]" />
			<div className="pointer-events-none absolute -bottom-48 -right-40 h-[32rem] w-[32rem] rounded-full bg-[color:var(--hero-glow-bottom)]/40 blur-[8.75rem]" />
			<div className="relative z-10">{children}</div>
		</div>
	)
}


