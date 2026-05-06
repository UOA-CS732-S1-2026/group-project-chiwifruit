import { useMemo, useState } from "react"
import { ArrowLeft, Lock, User, UserPlus, Users } from "lucide-react"
import { Link } from "react-router-dom"

import Background from "../components/Common/Background"
import BrandLockup from "../components/Common/BrandLockup"
import { Button } from "../components/ui/button"

const TAB_CONFIG = [
	{
		id: "register",
		label: "Register",
		Icon: UserPlus,
		buttonText: "Create Account",
		fields: [
			{ id: "register-username", label: "Username", placeholder: "NeonTiger", Icon: User },
			{ id: "register-password", label: "Password", placeholder: "Enter password", Icon: Lock, type: "password" },
			{ id: "register-confirm", label: "Confirm Password", placeholder: "Confirm password", Icon: Lock, type: "password" },
		],
	},
	{
		id: "login",
		label: "Login",
		Icon: User,
		buttonText: "Login",
		fields: [
			{ id: "login-username", label: "Username", placeholder: "NeonTiger", Icon: User },
			{ id: "login-password", label: "Password", placeholder: "Enter password", Icon: Lock, type: "password" },
		],
	},
	{
		id: "guest",
		label: "Guest",
		Icon: Users,
		buttonText: "Play as Guest",
		fields: [
			{ id: "guest-nickname", label: "Guest Nickname", placeholder: "MightyKiwi", Icon: User },
		],
	},
]

function Field({ id, label, placeholder, Icon, type = "text" }) {
	return (
		<label className="flex w-full flex-col gap-2 text-base font-semibold text-[#314158]" htmlFor={id}>
			<span>{label}</span>
			<div className="relative">
				<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#90a1b9]">
					<Icon className="size-5" />
				</span>
				<input
					id={id}
					type={type}
					placeholder={placeholder}
					className="h-16 w-full rounded-[14px] border-2 border-[#e2e8f0] bg-white pl-12 pr-4 text-lg font-medium text-[#091149] outline-none placeholder:text-[#90a1b9] focus:border-[#4a5eed]/40"
				/>
			</div>
		</label>
	)
}

export default function LoginPage() {
	const [activeTab, setActiveTab] = useState("register")
	const activeConfig = useMemo(() => TAB_CONFIG.find((tab) => tab.id === activeTab), [activeTab])

	return (
		<Background>
			<header className="flex items-center justify-between px-6 py-6 md:px-10">
				<Link
					to="/"
					className="inline-flex items-center gap-2 rounded-[14px] bg-white/70 px-4 py-2 text-sm font-medium text-[#62748e] shadow-sm ring-1 ring-[#e2e8f0] transition hover:bg-white"
				>
					<ArrowLeft className="size-4" />
					<span>Back to Home</span>
				</Link>
				<div className="hidden md:block" />
			</header>

			<main className="flex min-h-[calc(100vh-120px)] items-center justify-center px-6 pb-10">
				<div className="flex w-full max-w-[34rem] flex-col items-center gap-8 md:max-w-[36rem]">
					<div className="flex flex-col items-center gap-4">
						<BrandLockup className="scale-110 md:scale-125" />
					</div>

					<section className="w-full rounded-[24px] border border-[#f1f5f9] bg-white px-10 py-10 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] md:px-12 md:py-12">
						<div className="flex flex-col gap-2 text-center">
							<h1 className="text-3xl font-bold tracking-[-0.02em] text-[#091149]">Join the Game</h1>
							<p className="text-lg font-medium text-[#62748e]">
								Create an account to save your profile, or play as guest.
							</p>
						</div>

						<div className="mt-8 flex rounded-[14px] bg-[#f1f5f9] p-1">
							{TAB_CONFIG.map((tab) => {
								const isActive = tab.id === activeTab
								return (
									<button
										key={tab.id}
										type="button"
										onClick={() => setActiveTab(tab.id)}
										className={
											"flex flex-1 items-center justify-center gap-2 rounded-[10px] px-3 py-3 text-[0.95rem] font-bold transition " +
											(isActive
												? "bg-white text-[#4a5eed] shadow-[0px_1px_3px_rgba(0,0,0,0.1)]"
												: "text-[#62748e] hover:text-[#4a5eed]")
										}
									>
											<tab.Icon className="size-4" />
											<span>{tab.label}</span>
										</button>
									)
								})}
						</div>

						<form
							className="mt-8 flex flex-col gap-6"
							onSubmit={(event) => {
								event.preventDefault()
							}}
						>
							{activeConfig?.fields.map((field) => (
								<Field key={field.id} {...field} />
							))}
							{/* TODO: Wire register/login/guest submit handlers when backend auth endpoints are available. */}
							<Button type="submit" className="h-16 rounded-[14px] text-lg font-bold shadow-[0px_4px_14px_rgba(74,94,237,0.3)]">
								{activeConfig?.buttonText}
							</Button>
						</form>
					</section>
				</div>
			</main>
		</Background>
	)
}
