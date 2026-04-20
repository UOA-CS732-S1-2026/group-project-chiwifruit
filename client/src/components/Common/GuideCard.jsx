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
		<div className={cn("rounded-3xl border border-[#E8ECFA] bg-white/70 p-6 backdrop-blur-sm", className)}>
			<div
				className={cn(
					"mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B6DE8]",
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