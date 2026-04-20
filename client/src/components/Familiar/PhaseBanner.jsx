import { cn } from "../../lib/utils"

export default function PhaseBanner({ title, value, Icon, variant = "violet", className }) {
	const variantClasses =
		variant === "blue"
			? "border-border bg-sky-50 text-sky-700"
			: "border-violet-200/70 bg-violet-50 text-violet-700"

	return (
		<div
			className={cn(
				"mx-auto w-full max-w-3xl rounded-2xl border px-6 py-4 shadow-sm",
				variantClasses,
				className,
			)}
		>
			<div className="flex items-center justify-center gap-4">
				{Icon ? (
					<div className="grid size-9 place-items-center rounded-xl bg-white/70">
						<Icon className="size-5" />
					</div>
				) : null}
				<div className="text-center">
					<p className="text-xs font-semibold tracking-wide">{title}</p>
					<p className="mt-0.5 text-xl font-extrabold text-foreground">{value}</p>
				</div>
			</div>
		</div>
	)
}
