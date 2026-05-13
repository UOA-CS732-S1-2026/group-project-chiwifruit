import { Volume2 } from "lucide-react"
import { cn } from "../../lib/utils"

// Component: lightweight game message toast used for short non-error prompts.
export default function GameToast({ message, className }) {
	if (!message) return null

	return (
		<div className={cn("flex justify-center", className)}>
			<div className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white shadow-lg">
				<Volume2 className="size-4" />
				{message}
			</div>
		</div>
	)
}
