import logo from "../../assets/branding/logo.png"
import logoname from "../../assets/branding/logoname.png"
import { cn } from "../../lib/utils"

export default function BrandLockup({ className }) {
	return (
		<div className={cn("flex items-center gap-2.5 md:gap-3", className)}>
			<img src={logo} alt="Kichain icon" className="h-9 w-12 md:h-12 md:w-15" />
			<img
				src={logoname}
				alt="Kichain"
				className="h-auto w-[8.8rem] object-contain md:w-[10.2rem] lg:w-[11rem]"
			/>
		</div>
	)
}