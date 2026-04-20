import * as React from "react"

import { useNavigate } from "react-router-dom"
import { Clock, Info, Volume2 } from "lucide-react"

import Background from "../components/Common/Background"
import GameCard from "../components/Game/GameCard"
import SoundBoard from "../components/Game/SoundBoard"
import InfoCallout from "../components/Familiar/InfoCallout"
import PhaseBanner from "../components/Familiar/PhaseBanner"
import ReadyBar from "../components/Familiar/ReadyBar"

import useGameStore from "../store/useGameStore"

const STAGE = {
	AUTO_PLAY: 1,
	FREE_PLAY: 2,
}

export default function FamiliarPage() {
	const navigate = useNavigate()
	const padThemes = useGameStore((state) => state.padThemes)
	const ensurePadThemes = useGameStore((state) => state.ensurePadThemes)
	const padCount = padThemes?.length ?? 8

	const [stage, setStage] = React.useState(STAGE.AUTO_PLAY)
	const [autoPlayIndex, setAutoPlayIndex] = React.useState(0)
	const [secondsRemaining, setSecondsRemaining] = React.useState(20)

	React.useEffect(() => {
		ensurePadThemes()
	}, [ensurePadThemes])

	React.useEffect(() => {
		if (stage !== STAGE.AUTO_PLAY) return
		setAutoPlayIndex(0)
	}, [padCount, stage])

	React.useEffect(() => {
		if (stage !== STAGE.AUTO_PLAY) return

		const intervalId = window.setInterval(() => {
			setAutoPlayIndex((previous) => {
				const next = previous + 1
				if (next >= padCount) {
					window.clearInterval(intervalId)
					setStage(STAGE.FREE_PLAY)
					return Math.max(0, padCount - 1)
				}
				return next
			})
		}, 900)

		return () => window.clearInterval(intervalId)
	}, [padCount, stage])

	React.useEffect(() => {
		if (stage !== STAGE.FREE_PLAY) return

		setSecondsRemaining(20)
		const intervalId = window.setInterval(() => {
			setSecondsRemaining((previous) => Math.max(0, previous - 1))
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [stage])

	return (
		<Background>
			<div className="mx-auto w-full max-w-[90rem] px-4 pb-14 pt-10 md:px-6 lg:px-8">
				{stage === STAGE.AUTO_PLAY ? (
					<PhaseBanner
						Icon={Volume2}
						title="Playing All Sounds"
						value={`${Math.min(autoPlayIndex + 1, padCount)} / ${padCount}`}
						variant="violet"
					/>
				) : (
					<PhaseBanner
						Icon={Clock}
						title="Time Remaining to Familiarize"
						value={`${secondsRemaining}s`}
						variant="blue"
					/>
				)}

				<div className="mx-auto mt-6 w-full max-w-3xl space-y-5">
					<GameCard className="shadow-sm">
						<h1 className="hero-title text-xl font-extrabold tracking-[-0.02em]">Familiarization Phase</h1>
						<p className="text-muted-theme mt-1 text-sm">Listen to each bird call and try to remember them</p>
					</GameCard>

					<InfoCallout Icon={Info}>
						<p>
							The buttons are unlabeled or minimally labeled on purpose. This game tests your short-term memory,
							not note-taking skills.
						</p>
						{stage === STAGE.AUTO_PLAY ? (
							<p className="mt-1">Listen carefully as each sound plays automatically.</p>
						) : (
							<p className="mt-1">Take your time to practice before the match begins.</p>
						)}
					</InfoCallout>

					<GameCard>
						<h2 className="hero-title text-sm font-extrabold tracking-[-0.02em]">Available Sounds</h2>
						<p className="text-muted-theme mt-1 text-sm">
							{stage === STAGE.AUTO_PLAY
								? "Listening to automatic playback..."
								: "Click any button to hear its sound. You can practice as many times as you like."}
						</p>

						<div className="mt-5">
							<SoundBoard
								icon={Volume2}
								disabled={stage === STAGE.AUTO_PLAY}
								activePadIndex={stage === STAGE.AUTO_PLAY ? autoPlayIndex : null}
								onPadPress={() => {
									// TODO: play selected sound
								}}
							/>
						</div>
					</GameCard>

					{stage === STAGE.FREE_PLAY ? (
						<ReadyBar
							onStart={() => {
								navigate("/game")
							}}
						/>
					) : null}
				</div>
			</div>
		</Background>
	)
}
