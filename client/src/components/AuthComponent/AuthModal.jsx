import { createElement, useState } from "react"
import { ChevronLeft, KeyRound, LogIn, UserPlus, UserRound } from "lucide-react"

import logo from "../../assets/branding/logo.png"
import logoname from "../../assets/branding/logoname.png"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

const authModes = [
	{ id: "register", label: "Register", Icon: UserPlus },
	{ id: "login", label: "Login", Icon: LogIn },
	{ id: "guest", label: "Guest", Icon: UserRound },
]

function AuthField({ icon: FieldIcon, label, placeholder, type = "text" }) {
	return (
		<label className="block">
			<span className="text-[0.72rem] font-bold text-foreground">{label}</span>
			<span className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-3 text-muted-foreground shadow-sm transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
				{createElement(FieldIcon, { className: "size-4" })}
				<input
					type={type}
					placeholder={placeholder}
					className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/65"
				/>
			</span>
		</label>
	)
}

export default function AuthModal({ onBackToHome }) {
	const [mode, setMode] = useState("register")

	const handleSubmit = (event) => {
		event.preventDefault()
	}

	return (
		<section className="fixed inset-0 z-50 overflow-y-auto bg-background px-5 py-16">
			<button
				type="button"
				onClick={onBackToHome}
				className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:text-foreground md:left-10 md:top-8"
			>
				<ChevronLeft className="size-4" />
				Back to Home
			</button>

			<div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-6xl flex-col items-center justify-center">
				<div className="mb-7 flex flex-col items-center gap-3">
					<img src={logo} alt="Kichain icon" className="h-16 w-20 object-contain" />
					<img src={logoname} alt="Kichain" className="h-auto w-44 object-contain" />
				</div>

				<form
					onSubmit={handleSubmit}
					className="w-full max-w-[24rem] rounded-2xl border border-white/80 bg-card p-7 shadow-[0_1.5rem_3.25rem_rgba(15,23,42,0.18)]"
				>
					<div className="text-center">
						<h1 className="text-2xl font-extrabold text-foreground">Join the Game</h1>
						<p className="mx-auto mt-3 max-w-[17rem] text-sm leading-5 text-muted-foreground">
							Create an account to save your profile, or play as a guest.
						</p>
					</div>

					<div className="mt-6 grid grid-cols-3 rounded-xl bg-muted p-1">
						{authModes.map((authMode) => {
							const isActive = mode === authMode.id
							const TabIcon = authMode.Icon

							return (
								<button
									key={authMode.id}
									type="button"
									onClick={() => setMode(authMode.id)}
									className={cn(
										"flex h-9 items-center justify-center gap-1.5 rounded-lg text-[0.75rem] font-bold text-muted-foreground transition",
										isActive && "bg-card text-primary shadow-sm",
									)}
								>
									<TabIcon className="size-3.5" />
									{authMode.label}
								</button>
							)
						})}
					</div>

					<div className="mt-6 space-y-4">
						{mode === "guest" ? (
							<AuthField icon={UserRound} label="Guest Nickname" placeholder="MightyKiwi" />
						) : (
							<>
								<AuthField icon={UserRound} label="Username" placeholder="NeonTiger" />
								<AuthField icon={KeyRound} label="Password" placeholder="Enter password" type="password" />
								{mode === "register" && (
									<AuthField
										icon={KeyRound}
										label="Confirm Password"
										placeholder="Confirm password"
										type="password"
									/>
								)}
							</>
						)}
					</div>

					<Button type="submit" className="mt-5 h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-primary/25">
						{mode === "register" && "Create Account"}
						{mode === "login" && "Login"}
						{mode === "guest" && "Play as Guest"}
					</Button>
				</form>
			</div>
		</section>
	)
}
