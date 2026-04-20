import { cn } from "../../lib/utils"

export default function SoundPadButton({
	className,
	bgClassName,
	Icon,
	onClick,
	disabled,
	label,
	isActive,
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			className={cn(
				"relative grid aspect-square w-full place-items-center rounded-2xl border border-white/60 shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:opacity-60",
				"hover:brightness-[0.98]",
				isActive ? "ring-4 ring-white/70" : null,
				bgClassName,
				className,
			)}
		>
			{Icon ? <Icon className="size-7 text-white/90" /> : null}
		</button>
	)
}
