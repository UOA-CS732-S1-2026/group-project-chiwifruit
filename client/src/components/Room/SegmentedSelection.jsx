import { cn } from "../../lib/utils"

export default function SegmentedSelection({ value, options, onChange, disabled, className }) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm",
				className,
			)}
		>
			{options.map((option) => {
				const isActive = option.value === value
				const Icon = option.Icon

				return (
					<button
						key={option.value}
						type="button"
						disabled={disabled}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition",
							disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted",
							isActive
								? "bg-primary text-primary-foreground shadow"
								: "text-muted-foreground",
						)}
					>
							{Icon ? <Icon className="size-4" data-active={isActive} /> : null}
						{option.label}
					</button>
				)
			})}
		</div>
	)
}
