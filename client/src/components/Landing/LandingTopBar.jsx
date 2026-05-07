import BrandLockup from "../Common/BrandLockup"
import LoginButton from "../AuthComponent/LoginButton"
import SoundToggleButton from "../ui/SoundToggleButton"
import { getStoredAuthUser } from "../../api/axios"

// NOTE (2026-04-29): 顶栏直接读 storage 里的 user（guest/login 都可能存在），用于展示头像与用户名。

export default function LandingTopBar({ onLoginClick }) {
	const user = getStoredAuthUser()
	const avatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const label = typeof user?.username === "string" ? user.username : "Login"

	return (
		<>
			<BrandLockup className="absolute left-3 top-3 z-20 md:left-4 md:top-4 lg:left-6 lg:top-6" />

			<div className="absolute right-3 top-3 z-20 md:right-4 md:top-4 lg:right-6 lg:top-6">
				<div className="flex items-center gap-2">
					<SoundToggleButton />
					<LoginButton avatarUrl={avatarUrl} label={label} onClick={onLoginClick} />
				</div>
			</div>
		</>
	)
}
