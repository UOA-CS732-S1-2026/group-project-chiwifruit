import { cn } from "../../lib/utils"

export default function InfoCallout({ title = "Important:", children, className, Icon }) {
	return (
		<div className={cn("rounded-2xl border border-sky-200/70 bg-sky-50 px-5 py-4", className)}>
			<div className="flex items-start gap-3">
				{Icon ? <Icon className="mt-0.5 size-4 text-sky-700" /> : null}
				<div className="min-w-0">
					<p className="text-sm font-bold text-sky-900">{title}</p>
					<div className="mt-1 text-sm text-sky-800">{children}</div>
				</div>
			</div>
		</div>
	)
}
