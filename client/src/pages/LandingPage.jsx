import Background from "../components/Common/Background"
import bigLogo from "../assets/branding/biglogo.png"
import BrandLockup from "../components/Common/BrandLockup"
import LoginButton from "../components/AuthComponent/LoginButton"
import GuideCard from "../components/Common/GuideCard"
import { Button } from "../components/ui/button"
import { Headphones, LogIn, Play, PlusCircle, Sparkles, Trophy } from "lucide-react"

export default function LandingPage() {
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
			iconWrapClassName: "bg-muted text-chart-1",
		},
	]

	return (
		<Background>
			<BrandLockup className="absolute left-3 top-3 z-20 md:left-4 md:top-4 lg:left-6 lg:top-6" />

			<div className="absolute right-3 top-3 z-20 md:right-4 md:top-4 lg:right-6 lg:top-6">
				<LoginButton />
			</div>

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

						<div className="flex flex-wrap items-center gap-3 pt-1">
							<Button className="h-12 rounded-xl px-6 text-sm font-semibold hover:bg-primary/90">
								<Play className="size-4 fill-current" />
								Create a Room
							</Button>
							<Button
								variant="outline"
								className="h-12 rounded-xl border-border bg-card px-6 text-sm font-semibold text-foreground hover:border-ring hover:bg-card"
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
		</Background>
	)
}
