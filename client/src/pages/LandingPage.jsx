import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Background from "../components/Common/Background"
import bigLogo from "../assets/branding/biglogo.png"
import peopleBlueIcon from "../assets/people-blue.svg"
import alertIcon from "../assets/alert-red.svg"
import LandingTopBar from "../components/Landing/LandingTopBar"
import GuideCard from "../components/Landing/GuideCard"
import { Button } from "../components/ui/button"
import { Headphones, LogIn, Play, PlusCircle, Sparkles, Trophy } from "lucide-react"

export default function LandingPage() {
	const [isJoinOpen, setIsJoinOpen] = useState(false)
	const [roomCode, setRoomCode] = useState("")
	const isRoomFull = roomCode.trim().toUpperCase() === "FULL"
	const navigate = useNavigate()

	const handleJoinGame = () => {
		if (isRoomFull) {
			return
		}
		navigate("/room")
	}

	const guideItems = [
		{
			Icon: Headphones,
			title: "1. Listen closely",
			description: "Memorize the growing sequence of sounds played by the group.",
			iconWrapClassName: "bg-muted text-chart-2",
		},
		{
			Icon: PlusCircle,
			title: "2. Add your sound",
			description: "Successfully repeat the pattern and add your own unique sound to the end.",
			iconWrapClassName: "bg-muted text-chart-3",
		},
		{
			Icon: Trophy,
			title: "3. Last one standing",
			description: "Make a mistake and you're out. Outlast everyone else to win the game!",
			iconWrapClassName: "bg-amber-50 text-amber-500",
		},
	]

	return (
		<Background>
			<LandingTopBar />

			<section className="relative mx-auto w-full max-w-[90rem] px-4 pb-14 pt-24 md:px-6 md:pt-28 lg:px-8">
				<div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
					<div className="flex flex-col items-start gap-5 md:gap-6">
						<div className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-6 text-[0.8rem] font-bold tracking-[0.02em] text-accent-foreground shadow-sm uppercase">
							<Sparkles className="size-4" />
							<span>The Ultimate Musical Memory Game</span>
						</div>

						<div className="space-y-2 md:space-y-3">
							<h1 className="hero-title text-[clamp(3rem,6vw,5.25rem)] leading-[0.97] font-extrabold tracking-[-0.02em] lg:whitespace-nowrap">
								Build the sequence.
							</h1>
							<h2 className="hero-gradient-text text-[clamp(3rem,6vw,5.25rem)] leading-[0.97] font-extrabold tracking-[-0.02em] lg:whitespace-nowrap">
								Outlast your friends.
							</h2>
						</div>

						<p className="text-muted-theme max-w-[40ch] text-[1.02rem] leading-relaxed md:text-[1.08rem]">
							Test your memory in this multiplayer sound chain game. Listen to the sequence,
							repeat it perfectly, and add your own beat. One mistake and you&apos;re out!
						</p>

						<div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm">
							<img src={peopleBlueIcon} alt="" className="h-4 w-4" aria-hidden="true" />
							Perfect for 2 to 6 players per room
						</div>

						<div className="flex flex-wrap items-center gap-3 pt-1">
							<Button className="h-12 rounded-xl px-6 text-sm font-semibold hover:bg-primary/90">
								<Play className="size-4 fill-current" />
								Create a Room
							</Button>
							<Button
								variant="outline"
								className="h-12 rounded-xl border-border bg-card px-6 text-sm font-semibold text-foreground hover:border-ring hover:bg-card"
								onClick={() => setIsJoinOpen(true)}
							>
								<LogIn className="size-4" />
								Join with Code
							</Button>
						</div>
					</div>

					<div className="relative flex items-center justify-center lg:justify-end lg:pr-2">
						<div className="pointer-events-none absolute top-1/2 h-80 w-80 -translate-y-[46%] rounded-full bg-[color:var(--hero-glow-top)]/42 blur-[6.5625rem] md:right-16 lg:right-20" />
						<div className="pointer-events-none absolute top-1/2 h-80 w-80 -translate-y-[44%] rounded-full bg-[color:var(--hero-glow-bottom)]/48 blur-[7.1875rem] md:-right-1 lg:right-2" />
						<div className="pointer-events-none absolute top-1/2 h-96 w-96 -translate-y-[45%] rounded-full bg-white/58 blur-[4.875rem] md:right-8 lg:right-10" />

						<div className="relative z-10 w-[16rem] max-w-full drop-shadow-[0_1.5rem_3.25rem_rgba(74,94,237,0.32)] md:w-[22rem] lg:w-[26rem]">
							<img
								src={bigLogo}
								alt="Kichain logo"
								className="w-full will-change-transform motion-safe:[animation:scale-soft_2.4s_linear_infinite_alternate]"
							/>
						</div>
					</div>
				</div>

				<div className="mt-16 space-y-3">
					<h3 className="hero-title text-[2rem] font-extrabold tracking-[-0.02em]">How it works</h3>
					<p className="text-muted-theme text-lg">Three simple steps to become the chain champion.</p>
				</div>

				<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{guideItems.map((item) => (
						<GuideCard
							key={item.title}
							Icon={item.Icon}
							title={item.title}
							description={item.description}
							iconWrapClassName={item.iconWrapClassName}
						/>
					))}
				</div>
			</section>

			{isJoinOpen ? (
				<div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 px-4 backdrop-blur-[2px]">
					<div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								<h3 className="text-lg font-bold text-foreground">Join a Room</h3>
								<p className="text-sm text-muted-theme">
									Enter the room code shared by your friend to join their game.
								</p>
								<div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
									<img src={peopleBlueIcon} alt="" className="h-4 w-4" aria-hidden="true" />
									Supports 2 to 6 players
								</div>
							</div>
							<button
								type="button"
								className="inline-flex size-9 items-center justify-center rounded-full border border-transparent text-base font-semibold text-muted-theme transition hover:border-border hover:bg-muted"
								onClick={() => setIsJoinOpen(false)}
								aria-label="Close join room"
							>
								×
							</button>
						</div>

						{isRoomFull ? (
							<div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
								<span className="mt-0.5 inline-flex size-5 items-center justify-center">
									<img src={alertIcon} alt="" className="h-4 w-4" aria-hidden="true" />
								</span>
								<span>This room is already full! You can create a new room instead.</span>
							</div>
						) : null}

						<div className="mt-4 space-y-4">
							<input
								type="text"
								value={roomCode}
								onChange={(event) => setRoomCode(event.target.value)}
								placeholder="e.g. ABCD-1234"
								className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-slate-600 placeholder:text-slate-400 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40 ${
									isRoomFull
										? "border-border bg-card text-slate-400 placeholder:text-slate-400"
										: "border-border bg-card"
								}`}
							/>
							<Button
								className="h-11 w-full rounded-xl text-sm font-semibold"
								onClick={handleJoinGame}
							>
								Join Game
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</Background>
	)
}
