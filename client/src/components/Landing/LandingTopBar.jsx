import BrandLockup from "../Common/BrandLockup"
import LoginButton from "../AuthComponent/LoginButton"
import SoundToggleButton from "../ui/SoundToggleButton"

export default function LandingTopBar() {
	return (
		<>
			<BrandLockup className="absolute left-3 top-3 z-20 md:left-4 md:top-4 lg:left-6 lg:top-6" />

			<div className="absolute right-3 top-3 z-20 md:right-4 md:top-4 lg:right-6 lg:top-6">
				<div className="flex items-center gap-2">
					<SoundToggleButton />
					<LoginButton />
				</div>
			</div>
		</>
	)
}
