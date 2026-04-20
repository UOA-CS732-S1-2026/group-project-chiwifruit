import Background from "../components/Common/Background"
import { Button } from "../components/ui/button"
import { ArrowLeft, CircleCheck, Clock, Crown, Info, Volume2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import GameCard from "../components/Game/GameCard"
import PlayersPanel from "../components/Game/PlayersPanel"
import SoundBoard from "../components/Game/SoundBoard"

export default function GamePage() {
	const navigate = useNavigate()

	return (
		<Background>
			<div className="mx-auto w-full max-w-[90rem] px-4 pb-14 pt-6 md:px-6 lg:px-8">
				<div className="mb-5 flex items-center justify-between">
					<Button
						variant="ghost"
						className="h-9 gap-2 rounded-xl px-3 text-sm font-semibold text-foreground"
						onClick={() => navigate("/")}
					>
						<ArrowLeft className="size-4" />
						Leave Game
					</Button>
				</div>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
					<div className="space-y-6">
						<GameCard>
							<div className="flex items-start justify-between gap-4">
								<div>
									<h1 className="hero-title text-2xl font-extrabold tracking-[-0.02em]">Your Turn!</h1>
									<p className="text-muted-theme mt-1 text-sm">
										Round 1 &bull; Sequence Length: 0
									</p>
								</div>
								<div className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground">
									<Clock className="size-4" />
									25s
								</div>
							</div>

							<div className="mt-5 rounded-2xl border border-border bg-muted px-4 py-3">
								<div className="flex items-start gap-2">
									<Info className="mt-0.5 size-4 text-muted-foreground" />
									<p className="text-sm text-muted-foreground">You start! Choose your first sound.</p>
								</div>
							</div>
						</GameCard>

						<GameCard>
							<div>
								<h2 className="hero-title text-lg font-extrabold tracking-[-0.02em]">Your Input Progress</h2>
								<p className="text-muted-theme mt-1 text-sm">1 / 1 sounds entered</p>
							</div>

							<div className="mt-5 flex items-start gap-4">
								<div className="grid size-14 place-items-center rounded-2xl bg-emerald-500 text-white">
									<CircleCheck className="size-7" />
								</div>
								<div className="min-w-0 flex-1 rounded-2xl border border-emerald-200/60 bg-emerald-50 px-4 py-3">
									<p className="text-sm font-medium text-emerald-900">Submitting your sequence...</p>
								</div>
							</div>
						</GameCard>

						<GameCard>
							<div>
								<h2 className="hero-title text-lg font-extrabold tracking-[-0.02em]">Sound Board</h2>
								<p className="text-muted-theme mt-1 text-sm">Click the buttons to input your sequence</p>
							</div>

							<div className="mt-5">
								<SoundBoard
									icon={Volume2}
									onPadPress={() => {
										// TODO: hook into game state + socket events
									}}
								/>
							</div>
						</GameCard>
					</div>

					<div className="lg:sticky lg:top-6">
						<PlayersPanel
							title="Players"
							subtitle="2 of 2 remaining"
							players={[
								{ id: "1", name: "WiseSwan60", alive: true, isHost: true },
								{ id: "2", name: "SlyFalcon81", alive: true, isHost: false },
							]}
							hostIcon={Crown}
						/>
					</div>
				</div>
			</div>
		</Background>
	)
}
