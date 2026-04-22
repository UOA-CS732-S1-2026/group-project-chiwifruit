import * as React from "react"

import { ArrowLeft, ChevronsRight, Volume2 } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import Background from "../components/Common/Background"
import ExitGameModal from "../components/Game/ExitGameModal"
import GamePlayerCard from "../components/Game/GamePlayerCard"
import GameToast from "../components/Game/GameToast"
import GameWheel from "../components/Game/GameWheel"
import YoureOutModal from "../components/Game/YoureOutModal"
import { Button } from "../components/ui/button"

import logo from "../assets/branding/logo.png"
import { buildPadThemeSet, getPadCountByDifficulty } from "../lib/gamePadPalette"

const PHASE = {
	FAMILIARIZE_AUTO: "familiarize:auto",
	FAMILIARIZE_FREE: "familiarize:free",
	START_COUNTDOWN: "start:countdown",
	PLAYING: "playing",
}

function coerceDifficulty(value) {
	if (value === "easy") return "easy"
	if (value === "hard") return "hard"
	return "medium"
}

export default function GamePage() {
	const navigate = useNavigate()
	const location = useLocation()

	const difficulty = coerceDifficulty(location.state?.difficulty)
	const padCount = getPadCountByDifficulty(difficulty)

	const [phase, setPhase] = React.useState(PHASE.FAMILIARIZE_AUTO)
	const [padThemes, setPadThemes] = React.useState(() => buildPadThemeSet(difficulty))
	const [activePadIndex, setActivePadIndex] = React.useState(null)
	const [autoPlayIndex, setAutoPlayIndex] = React.useState(0)
	const [freePlaySeconds, setFreePlaySeconds] = React.useState(20)
	const [startSeconds, setStartSeconds] = React.useState(5)

	const [sequence, setSequence] = React.useState([])
	const [inputCount, setInputCount] = React.useState(0)
	const requiredInputCount = Math.max(1, sequence.length + 1)

	const [toastMessage, setToastMessage] = React.useState("Familiarize yourself with the notes!")

	const players = React.useMemo(
		() => [
			{ id: "1", name: "Alex (You)", score: 0, side: "left" },
			{ id: "2", name: "Jordan", score: 0, side: "left" },
			{ id: "3", name: "Casey", score: 0, side: "left" },
			{ id: "4", name: "Riley", score: 0, side: "right" },
			{ id: "5", name: "Taylor", score: 0, side: "right" },
			{ id: "6", name: "Sam", score: 0, side: "right" },
		],
		[],
	)

	const [currentTurnIndex, setCurrentTurnIndex] = React.useState(0)
	const [turnSeconds, setTurnSeconds] = React.useState(20)
	const [isExitModalOpen, setIsExitModalOpen] = React.useState(false)
	const [isOutModalOpen, setIsOutModalOpen] = React.useState(false)
	const [isSpectating, setIsSpectating] = React.useState(false)

	React.useEffect(() => {
		setPadThemes(buildPadThemeSet(difficulty))
		setSequence([])
		setInputCount(0)
		setPhase(PHASE.FAMILIARIZE_AUTO)
		setAutoPlayIndex(0)
		setFreePlaySeconds(20)
		setStartSeconds(5)
		setToastMessage("Familiarize yourself with the notes!")
		setCurrentTurnIndex(0)
		setTurnSeconds(20)
		setIsExitModalOpen(false)
		setIsOutModalOpen(false)
		setIsSpectating(false)
	}, [difficulty])

	React.useEffect(() => {
		if (phase !== PHASE.PLAYING) return
		if (isOutModalOpen) return
		if (isSpectating) return
		if (currentTurnIndex !== 0) return
		if (turnSeconds !== 0) return

		setIsSpectating(true)
		setIsOutModalOpen(true)
		setToastMessage("You're out! You can keep spectating.")
	}, [currentTurnIndex, isOutModalOpen, isSpectating, phase, turnSeconds])

	React.useEffect(() => {
		if (phase !== PHASE.FAMILIARIZE_AUTO) return

		setToastMessage("Familiarize yourself with the notes!")
		setAutoPlayIndex(0)

		const intervalId = window.setInterval(() => {
			setAutoPlayIndex((previous) => {
				const next = previous + 1
				if (next >= padCount) {
					window.clearInterval(intervalId)
					setPhase(PHASE.FAMILIARIZE_FREE)
					setActivePadIndex(null)
					return Math.max(0, padCount - 1)
				}
				return next
			})
		}, 900)

		return () => window.clearInterval(intervalId)
	}, [padCount, phase])

	React.useEffect(() => {
		if (phase !== PHASE.FAMILIARIZE_AUTO) return
		setActivePadIndex(autoPlayIndex)
	}, [autoPlayIndex, phase])

	React.useEffect(() => {
		if (phase !== PHASE.FAMILIARIZE_FREE) return
		setToastMessage("Familiarize yourself with the notes!")
		setFreePlaySeconds(20)

		const intervalId = window.setInterval(() => {
			setFreePlaySeconds((previous) => {
				const next = Math.max(0, previous - 1)
				if (next === 0) {
					window.clearInterval(intervalId)
					setPhase(PHASE.START_COUNTDOWN)
					return 0
				}
				return next
			})
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [phase])

	React.useEffect(() => {
		if (phase !== PHASE.START_COUNTDOWN) return
		setStartSeconds(5)
		setToastMessage("Get ready — match starting!")

		const intervalId = window.setInterval(() => {
			setStartSeconds((previous) => {
				const next = Math.max(0, previous - 1)
				if (next === 0) {
					window.clearInterval(intervalId)
					setPhase(PHASE.PLAYING)
					setToastMessage("Game started! You go first. Press any note.")
					return 0
				}
				return next
			})
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [phase])

	React.useEffect(() => {
		if (phase !== PHASE.PLAYING) return
		setTurnSeconds(20)

		const intervalId = window.setInterval(() => {
			setTurnSeconds((previous) => Math.max(0, previous - 1))
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [phase, currentTurnIndex])

	const isFamiliarize =
		phase === PHASE.FAMILIARIZE_AUTO || phase === PHASE.FAMILIARIZE_FREE || phase === PHASE.START_COUNTDOWN

	const centerPill = isFamiliarize ? (
		<div className="flex flex-col items-center gap-3">
			<div className="h-[66px] min-w-[177px] rounded-full border border-[#96f7e4] bg-white shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]">
				<div className="flex size-full flex-col items-center justify-center px-[25px] py-[9px] text-center">
					<p className="text-[18px] font-bold leading-7 tracking-[0.9px] text-[#00bba7] uppercase">
						FAMILIARIZE!
					</p>
					<p className="-mt-0.5 font-bold text-[#62748e]">
						{phase === PHASE.FAMILIARIZE_AUTO ? (
							<span className="text-[14px] leading-5">
								Playing sounds {Math.min(autoPlayIndex + 1, padCount)} / {padCount}
							</span>
						) : (
							<>
								<span className="text-[12px] leading-4">
									{phase === PHASE.FAMILIARIZE_FREE ? "Free play ends in " : "Game starts in "}
								</span>
								<span className="text-[14px] leading-5 text-[#00bba7]">
									{phase === PHASE.FAMILIARIZE_FREE ? `${freePlaySeconds}s` : `${startSeconds}s`}
								</span>
							</>
						)}
					</p>
				</div>
			</div>

			<button
				type="button"
				onClick={() => setPhase(PHASE.START_COUNTDOWN)}
				className="inline-flex items-center justify-center gap-1 text-center text-[10px] font-bold leading-[15px] tracking-[1px] text-[#90a1b9] uppercase"
			>
				<span>Click to Skip</span>
				<ChevronsRight className="size-3" />
			</button>
		</div>
	) : null

	const handlePadPress = (index) => {
		if (phase === PHASE.PLAYING && isSpectating) return

		setActivePadIndex(index)
		window.setTimeout(() => setActivePadIndex(null), 180)

		if (phase === PHASE.PLAYING) {
			setInputCount((previous) => {
				const next = previous + 1
				if (next >= requiredInputCount) {
					setSequence((seq) => [...seq, index])
					setToastMessage(`${players[currentTurnIndex]?.name ?? "Player"} added a note! Turn over.`)
					setInputCount(0)
					setCurrentTurnIndex((turn) => (turn + 1) % players.length)
					return 0
				}
				return next
			})
		}
	}

	const leftPlayers = players.filter((p) => p.side === "left")
	const rightPlayers = players.filter((p) => p.side === "right")

	const showAddNote = inputCount >= sequence.length

	return (
		<Background>
			<ExitGameModal
				open={isExitModalOpen}
				onCancel={() => setIsExitModalOpen(false)}
				onConfirm={() => {
					setIsExitModalOpen(false)
					navigate("/")
				}}
			/>
			<YoureOutModal
				open={isOutModalOpen}
				onKeepSpectating={() => setIsOutModalOpen(false)}
				onBackToWaitingRoom={() => {
					setIsOutModalOpen(false)
					navigate("/room")
				}}
			/>
			<div className="mx-auto w-full max-w-[90rem] px-4 pb-14 pt-6 md:px-6 lg:px-8">
				<div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
					<div className="justify-self-start">
						<Button
							type="button"
							variant="outline"
							className="h-10 rounded-xl bg-card px-4 text-sm font-semibold text-foreground shadow-sm"
							onClick={() => setIsExitModalOpen(true)}
						>
							<ArrowLeft className="size-4" />
							Exit Game
						</Button>
					</div>

					<div className="justify-self-center text-center">
						<p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Sequence Length</p>
						<p className="mt-1 text-3xl font-extrabold text-foreground">{sequence.length}</p>
					</div>

					<div className="justify-self-end">
						<Button
							type="button"
							variant="outline"
							size="icon-lg"
							className="cursor-pointer rounded-2xl bg-card shadow-sm transition-colors hover:bg-muted hover:shadow-md active:scale-[0.98]"
							aria-label="Sound"
							title="Sound"
						>
							<Volume2 className="size-5" />
						</Button>
					</div>
				</div>

				{phase === PHASE.PLAYING ? (
					<div className="mt-10">
						<div className="mx-auto flex w-full max-w-[600px] flex-col items-center gap-3 pt-2">
							<div className="w-[360px]">
								<div className="flex items-end justify-between px-2">
									<p className="text-[12px] font-bold leading-4 tracking-[1.2px] text-[#62748e] uppercase">
										Input Progress
									</p>
									<p className="text-[14px] font-bold leading-5 text-[#00bba7]">
										<span>{inputCount} </span>
										<span className="text-[#cad5e2]">/</span>
										<span>{` ${requiredInputCount}`}</span>
									</p>
								</div>
							</div>

							<div className="h-3 w-[360px] rounded-full bg-[#e2e8f0] shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)]">
								<div className={(requiredInputCount > 1 ? "gap-1" : "") + " flex size-full items-start overflow-hidden rounded-full p-[2px]"}>
									{Array.from({ length: requiredInputCount }).map((_, segmentIndex) => {
										const isDone = segmentIndex < inputCount
										const isCurrent = segmentIndex === inputCount
										return (
											<div
												key={`progress-${segmentIndex}`}
												className={
													"h-2 min-w-px flex-1 rounded-full " +
													(isDone
														? "bg-[#00d5be] shadow-[0px_0px_8px_0px_rgba(45,212,191,0.6)]"
														: isCurrent
															? "bg-[rgba(70,236,213,0.4)] opacity-[0.54]"
															: "bg-[rgba(202,213,226,0.5)]")
												}
											/>
										)
									})}
								</div>
							</div>

							<div className="h-4 w-[360px] pt-[1.5px]">
								<p
									className={
										"text-center text-[10px] font-bold leading-[15px] tracking-[0.5px] uppercase " +
										(showAddNote
											? "text-[#615fff] opacity-[0.52]"
											: "text-[#00bba7] opacity-[0.63]")
									}
								>
									{showAddNote ? "ADD A NEW NOTE!" : "REPEATING SEQUENCE..."}
								</p>
							</div>
						</div>
					</div>
				) : (
					<div className="mt-10" />
				)}

				<div className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-[18rem_1fr_18rem]">
					<div className="space-y-4">
						{leftPlayers.map((player) => {
							const playerIndex = players.findIndex((p) => p.id === player.id)
							const isCurrentTurn = phase === PHASE.PLAYING && playerIndex === currentTurnIndex
							return (
								<GamePlayerCard
									key={player.id}
									name={player.name}
									score={player.score}
									status="WAITING"
									isCurrentTurn={isCurrentTurn}
									turnSeconds={isCurrentTurn ? turnSeconds : undefined}
								/>
							)
						})}
					</div>

					<div className="flex flex-col items-center">
						{centerPill ? <div className="z-20 mb-3">{centerPill}</div> : null}
						<GameWheel
							pads={padThemes}
							activePadIndex={activePadIndex}
							disabled={phase === PHASE.FAMILIARIZE_AUTO}
							onPadPress={handlePadPress}
							centerContent={<img src={logo} alt="Kichain" className="h-20 w-24" />}
						/>

						<p className="mt-6 text-center text-xs font-semibold text-muted-foreground">
							{phase === PHASE.FAMILIARIZE_AUTO
								? `Difficulty: ${difficulty.toUpperCase()} • ${padCount} sounds`
								: ""}
						</p>
					</div>

					<div className="space-y-4">
						{rightPlayers.map((player) => {
							const playerIndex = players.findIndex((p) => p.id === player.id)
							const isCurrentTurn = phase === PHASE.PLAYING && playerIndex === currentTurnIndex
							return (
								<GamePlayerCard
									key={player.id}
									name={player.name}
									score={player.score}
									status="WAITING"
									isCurrentTurn={isCurrentTurn}
									turnSeconds={isCurrentTurn ? turnSeconds : undefined}
								/>
							)
						})}
					</div>
				</div>

				<GameToast message={toastMessage} className="mt-8" />
			</div>
		</Background>
	)
}
