import BrandLockup from "../Common/BrandLockup"
import SoundToggleButton from "../ui/SoundToggleButton"
import { UserRound } from "lucide-react"
import { getStoredAuthUser } from "../../api/axios"

// NOTE (2026-04-29): 顶栏直接读 storage 里的 user（guest/login 都可能存在），用于展示头像与用户名。

export default function LandingTopBar() {
	const user = getStoredAuthUser()
	const avatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const username =
		typeof user?.username === "string" && user.username.trim()
			? user.username.trim()
			: "Player"

	return (
		<>
			<BrandLockup className="absolute left-3 top-3 z-20 md:left-4 md:top-4 lg:left-6 lg:top-6" />

			<div className="absolute right-3 top-3 z-20 md:right-4 md:top-4 lg:right-6 lg:top-6">
				<div className="flex items-center gap-2">
					<SoundToggleButton />
					<div className="flex h-12 items-center gap-2 rounded-full border border-border bg-card/85 px-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm">
						<div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
							{avatarUrl ? (
								<img src={avatarUrl} alt="User avatar" className="h-full w-full object-cover" />
							) : (
								<UserRound className="size-4 text-muted-foreground" />
							)}
						</div>
						<span className="max-w-28 truncate">{username}</span>
					</div>
				</div>
			</div>
		</>
	)
}
