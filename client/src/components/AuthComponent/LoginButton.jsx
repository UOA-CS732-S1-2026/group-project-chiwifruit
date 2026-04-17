import { UserRound } from "lucide-react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

export default function LoginButton({
	avatarUrl,
	avatarAlt = "User avatar",
	label = "Login",
	onClick,
	className,
}) {
	const isAvatarMode = Boolean(avatarUrl)

	return (
		<Button
			variant="outline"
			size="lg"
			onClick={onClick}
			className={cn(
				"rounded-full border-[#DDE4FF] bg-white/85 px-4 text-[#091149] backdrop-blur-sm hover:border-[#4A5EED] hover:bg-white",
				className,
			)}
		>
			{isAvatarMode ? (
				<>
					<img
						src={avatarUrl}
						alt={avatarAlt}
						className="size-6 rounded-full object-cover ring-1 ring-[#DDE4FF]"
					/>
					<span className="max-w-24 truncate">{label}</span>
				</>
			) : (
				<>
					<UserRound className="size-4 text-[#94A3B8]" />
					{label}
				</>
			)}
		</Button>
	)
}