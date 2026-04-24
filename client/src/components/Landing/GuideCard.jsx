import { cn } from "../../lib/utils"

export default function GuideCard({
	Icon,
	title,
	description,
	iconWrapClassName,
	iconClassName,
	className,
}) {
	return (
		<div
			className={cn(
				"rounded-3xl border border-white/70 bg-card/85 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm",
				className,
			)}
		>
			<div
				className={cn(
					"mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-muted text-accent-foreground",
					iconWrapClassName,
				)}
			>
				{Icon ? <Icon className={cn("size-5", iconClassName)} /> : null}
			</div>
			<h4 className="hero-title text-[1.65rem] font-extrabold leading-tight tracking-[-0.02em]">{title}</h4>
			<p className="text-muted-theme mt-3 text-[1.02rem] leading-relaxed">{description}</p>
		</div>
	)
}
