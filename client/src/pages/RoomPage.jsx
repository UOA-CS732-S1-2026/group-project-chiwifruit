import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Check, CircleDot, Copy, Eye, Flame, LogOut, Music, Play, Users, Zap } from "lucide-react"

import Background from "../components/Common/Background"
import BrandLockup from "../components/Common/BrandLockup"
import RoomPill from "../components/Room/RoomPill"
import RoomSectionLabel from "../components/Room/RoomSectionLabel"
import SegmentedSelection from "../components/Room/SegmentedSelection"
import PlayerSlotCard from "../components/Room/PlayerSlotCard"
import { Button } from "../components/ui/button"
import SoundToggleButton from "../components/ui/SoundToggleButton"

import birdIcon from "../assets/icons/bird.svg"
import useBackgroundMusic from "../hooks/useBackgroundMusic"


function BirdIcon({ className, ...props }) {
	const isActive = Boolean(props["data-active"])

	return (
		<img
			src={birdIcon}
			alt=""
			aria-hidden="true"
			className={"size-4 " + (className ?? "")}
			style={{
				filter: isActive ? "brightness(0) invert(1)" : "none",
			}}
		/>
	)
}

export default function RoomPage() {
	const navigate = useNavigate()
	const location = useLocation()
	useBackgroundMusic()

	const initialIsHost = location.state?.isHost ?? true
	const initialRoomCode = location.state?.roomCode ?? "1234"
	
	// State management
	const [isHost, setIsHost] = useState(Boolean(initialIsHost))
	const [currentUserReady, setCurrentUserReady] = useState(false)
	const [soundMode, setSoundMode] = useState("kiwi")
	const [difficulty, setDifficulty] = useState("easy")

	const roomCode = String(initialRoomCode)
	const players = useMemo(
		() => [
			{
				id: 1,
				username: isHost ? "Alex (You)" : "Alex",
				avatar: "👨‍🎨",
				isHost: true,
				isReady: true,
			},
			{
				id: 2,
				username: isHost ? "Jordan" : "Jordan (You)",
				avatar: "🧍‍♀️",
				isHost: false,
				isReady: !isHost && currentUserReady,
			},
			{ id: 3, isEmpty: true },
			{ id: 4, isEmpty: true },
			{ id: 5, isEmpty: true },
			{ id: 6, isEmpty: true },
		],
		[isHost, currentUserReady],
	)

	const nonEmptyPlayers = players.filter((p) => !p.isEmpty)
	const readyPlayers = nonEmptyPlayers.filter((p) => p.isReady).length
	const totalPlayers = players.length

	const handleToggleHost = () => {
		setIsHost(!isHost)
		setCurrentUserReady(false)
	}

	const handleReady = () => {
		setCurrentUserReady(!currentUserReady)
	}

	const handleStartGame = () => {
		if (!isHost) return
		if (!canStartGame) return
		navigate("/game", { state: { difficulty, soundMode } })
	}

	const canStartGame = isHost && readyPlayers === nonEmptyPlayers.length

	const handleCopyCode = async () => {
		try {
			await navigator.clipboard.writeText(roomCode)
		} catch {
			// no-op: clipboard can fail without user gesture / permissions
		}
	}

	return (
		<Background>
			<div className="min-h-screen">
				<header className="flex items-center justify-between px-8 py-5">
					<BrandLockup />
					<div className="flex items-center gap-3">
						<SoundToggleButton />
						<Button
							type="button"
							onClick={handleToggleHost}
							variant="outline"
							className="rounded-full border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-primary/15"
						>
							<Eye className="size-4" />
							{isHost ? "View as Guest" : "View as Host"}
						</Button>
						<Button
							type="button"
							onClick={() => navigate("/")}
							variant="outline"
							className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted"
						>
							<LogOut className="size-4" />
							Leave Room
						</Button>
					</div>
				</header>

				<main className="mx-auto max-w-6xl px-6 pb-12">
					<h1 className="text-center text-4xl font-bold text-foreground md:text-5xl">Waiting Room</h1>

					<div className="mt-6 flex flex-wrap items-center justify-center gap-4">
						<RoomPill>
							<span className="text-muted-foreground">Room Code:</span>
							<span className="text-lg font-bold text-primary">{roomCode}</span>
							<button
								type="button"
								onClick={handleCopyCode}
								className="text-muted-foreground hover:text-foreground"
								aria-label="Copy room code"
								title="Copy room code"
							>
								<Copy className="size-4" />
							</button>
						</RoomPill>
						<RoomPill className="border-primary/20 bg-primary/10 text-primary">
							<Users className="size-4" />
							{nonEmptyPlayers.length} / {totalPlayers} Players
						</RoomPill>
					</div>

					<div className="mt-8 flex flex-col items-center gap-6">
						<RoomSectionLabel isHost={isHost} />

						<div className="flex flex-wrap items-start justify-center gap-8">
							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-muted-foreground">Sound Mode</p>
								<SegmentedSelection
									value={soundMode}
									disabled={!isHost}
									onChange={(next) => setSoundMode(next)}
									options={[
										{ value: "kiwi", label: "Kiwi", Icon: BirdIcon },
										{ value: "piano", label: "Piano", Icon: Music },
									]}
								/>
							</div>

							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</p>
								<SegmentedSelection
									value={difficulty}
									disabled={!isHost}
									onChange={(next) => setDifficulty(next)}
									options={[
										{ value: "easy", label: "Easy", Icon: CircleDot },
										{ value: "normal", label: "Normal", Icon: Zap },
										{ value: "hard", label: "Hard", Icon: Flame },
									]}
								/>
							</div>
						</div>
					</div>

					<div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{players.map((player) => (
							<PlayerSlotCard
								key={player.id}
								player={player}
								isCurrentUser={!player.isEmpty && (isHost ? player.isHost : !player.isHost)}
							/>
						))}
					</div>

					<div className="mt-10 flex justify-center">
						{isHost ? (
							<Button
								type="button"
								onClick={handleStartGame}
								disabled={!canStartGame}
								className="h-12 rounded-full px-12 text-base font-semibold shadow-lg"
							>
								<Play className="size-4 fill-current" />
								Start Game
							</Button>
						) : (
							<Button
								type="button"
								onClick={handleReady}
								variant={currentUserReady ? "default" : "outline"}
								className={
									currentUserReady
										? "h-12 rounded-full px-12 text-base font-semibold ready-gradient-theme ready-shadow-theme"
										: "h-12 rounded-full px-12 text-base font-semibold shadow-lg"
								}
							>
								{currentUserReady ? (
									<>
										<Check className="size-4" />
										Ready!
									</>
								) : (
									"Click to Ready"
								)}
							</Button>
						)}
					</div>
				</main>
			</div>
		</Background>
	)
}
