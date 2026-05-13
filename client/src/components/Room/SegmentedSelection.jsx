import { cn } from "../../lib/utils"

// Component: render a segmented button group for mutually exclusive room settings
// such as mode and difficulty.
export default function SegmentedSelection({ value, options, onChange, disabled, className }) {
	return (
		<div
			className={cn(
				"flex items-center rounded-[22px] border border-[#F1F5F9] bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_18px_rgba(15,23,42,0.06)]",
				className,
			)}
		>
			{options.map((option) => {
				// Derived state: style the matching option as the currently selected segment.
				const isActive = option.value === value
				const Icon = option.Icon

				return (
					<button
						key={option.value}
						type="button"
						disabled={disabled}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex h-12 min-w-[120px] items-center justify-center gap-2 rounded-[15px] px-5 text-base font-bold transition",
							disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted",
							!disabled ? "cursor-pointer" : "",
							isActive
								? "bg-[linear-gradient(135deg,#4A5EED_0%,#7B5EED_100%)] text-primary-foreground shadow-[0_8px_18px_rgba(74,94,237,0.28)]"
								: "text-muted-foreground",
						)}
					>
						{Icon ? <Icon className="size-5" data-active={isActive} /> : null}
						{option.label}
					</button>
				)
			})}
		</div>
	)
}
