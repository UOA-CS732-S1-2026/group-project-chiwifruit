import { UserRound } from "lucide-react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

// Component: shared account button that shows either an avatar + label or a
// generic login icon + label.
export default function LoginButton({
	avatarUrl,
	avatarAlt = "User avatar",
	label = "Login",
	onClick,
	className,
}) {
	// Derived state: switch to avatar presentation only when an avatar URL is available.
	const isAvatarMode = Boolean(avatarUrl)

	return (
		<Button
			variant="outline"
			size="lg"
			onClick={onClick}
			className={cn(
				"rounded-full border-border bg-card/85 px-4 text-foreground backdrop-blur-sm hover:border-ring hover:bg-card",
				className,
			)}
		>
			{isAvatarMode ? (
				<>
					<img
						src={avatarUrl}
						alt={avatarAlt}
						className="size-6 rounded-full object-cover ring-1 ring-border"
					/>
					<span className="max-w-24 truncate">{label}</span>
				</>
			) : (
				<>
					<UserRound className="size-4 text-muted-foreground" />
					{label}
				</>
			)}
		</Button>
	)
}