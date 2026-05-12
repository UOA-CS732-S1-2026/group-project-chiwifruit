import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Check, CircleDot, Copy, Flame, Landmark, LogOut, Music, PawPrint, Users, Zap } from "lucide-react"

import Background from "../components/Common/Background"
import BrandLockup from "../components/Common/BrandLockup"
import LoginButton from "../components/AuthComponent/LoginButton"
import RoomPill from "../components/Room/RoomPill"
import RoomSectionLabel from "../components/Room/RoomSectionLabel"
import SegmentedSelection from "../components/Room/SegmentedSelection"
import PlayerSlotCard from "../components/Room/PlayerSlotCard"
import WaitingRoomActionBar from "../components/Room/WaitingRoomActionBar"
import { Button } from "../components/ui/button"
import ErrorToast from "../components/ui/ErrorToast"
import SoundToggleButton from "../components/ui/SoundToggleButton"
import { useRoomSocketUpdates } from "../hooks/useSocketListeners"
import {
	useJoinRoomMutation,
	useLeaveRoomMutation,
	useSelectDifficultyMutation,
	useSelectModeMutation,
	useSetReadyMutation,
} from "../hooks/mutations/useRoomMutations"
import { useRoomQuery } from "../hooks/queries/useRoomQuery"
import { getApiErrorMessage, getStoredAuthToken, getStoredAuthUser } from "../api/axios"
import { WAITING_ROOM_STICKERS } from "../components/Common/floatingStickerConfigs"

import birdIcon from "../assets/icons/bird.svg"
import kangarooIcon from "../assets/icons/kangaroo.svg"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import { emitGameRequestState, emitGameStart, joinSocketRoom, reconnectSocket } from "../socket/socket"

// NOTE (2026-04-29): The waiting room relies on two systems:
// - REST: join/leave room, ready/mode/difficulty — room participants and configuration
// - Socket: subscribe to room_update / game_state real-time broadcasts and auto-navigate when the game starts
// Important: use REST leaveRoom to exit the waiting room; socket leave_room means "leave the match = forfeit" in this app.

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

function AussieIcon({ className, ...props }) {
	const isActive = Boolean(props["data-active"])

	return (
		<img
			src={kangarooIcon}
			alt=""
			aria-hidden="true"
			className={className}
			style={{
				filter: isActive ? "brightness(0) invert(1)" : "none",
			}}
			{...props}
		/>
	)
}

export default function RoomPage() {
	const navigate = useNavigate()
	const { roomCode: roomCodeParam = "" } = useParams()
	// Background music is enabled on Landing + Room pages.
	useBackgroundMusic()

	const normalizedParamCode = String(roomCodeParam).trim().toUpperCase()
	const requestedJoinCode = normalizedParamCode === "NEW" ? "" : normalizedParamCode
	const [roomCode, setRoomCode] = useState("")
	const [setupError, setSetupError] = useState("")
	const [isStartingGame, setIsStartingGame] = useState(false)
	const [copyState, setCopyState] = useState("idle")

	const startedSetupRef = useRef(false)
	const hasNavigatedToGameRef = useRef(false)
	const copyResetTimerRef = useRef(null)
	const pageLeaveSentRef = useRef(false)

	useEffect(() => {
		startedSetupRef.current = false
		setSetupError("")
		setIsStartingGame(false)
	}, [normalizedParamCode])

	const joinRoomMutation = useJoinRoomMutation({
		onSuccess: (data) => {
			setSetupError("")
			setRoomCode(String(data?.roomCode ?? requestedJoinCode))
		},
		onError: (error) => {
			setSetupError(getApiErrorMessage(error))
		},
	})

	const leaveRoomMutation = useLeaveRoomMutation({
		onError: (error) => {
			setSetupError(getApiErrorMessage(error))
		},
	})

	const selectModeMutation = useSelectModeMutation()
	const selectDifficultyMutation = useSelectDifficultyMutation()
	const setReadyMutation = useSetReadyMutation()

	useEffect(() => {
		if (startedSetupRef.current) return
		startedSetupRef.current = true

		if (!requestedJoinCode) {
			setSetupError("Missing room code. Please go back and join/create from landing page.")
			navigate("/", { replace: true })
			return
		}

		const token = getStoredAuthToken()
		if (!token) {
			setSetupError("Missing session. Please join from the home page.")
			navigate("/", { replace: true })
			return
		}

		joinRoomMutation.mutate(requestedJoinCode)
	}, [joinRoomMutation, navigate, requestedJoinCode])

	const { data: roomState, isLoading: isRoomLoading, error: roomQueryError } = useRoomQuery(
		roomCode,
		Boolean(roomCode),
	)
	useRoomSocketUpdates(roomCode)

	const mode = roomState?.mode ?? "bird"
	const difficulty = roomState?.difficulty ?? "easy"

	const identity = useMemo(() => {
		const user = getStoredAuthUser()
		if (!user?.id) return null
		return { sub: String(user.id) }
	}, [])

	const hostUserId = roomState?.hostId ? String(roomState.hostId) : null
	const isHost = Boolean(identity?.sub) && Boolean(hostUserId) && identity.sub === hostUserId

	const players = useMemo(() => {
		const participants = roomState?.participants ?? []
		const mapped = participants.map((participant) => {
			const participantId = String(participant.userId)
			const isCurrentUser = Boolean(identity?.sub) && participantId === identity.sub
			return {
				id: participantId,
				username: isCurrentUser ? `${participant.username} (You)` : participant.username,
				avatarUrl: typeof participant.avatarUrl === "string" ? participant.avatarUrl : undefined,
				isHost: Boolean(hostUserId) && participantId === hostUserId,
				isReady: Boolean(participant.isReady),
			}
		})

		const maxCount = roomState?.maxParticipantCount ?? 6
		const emptySlots = Array.from({ length: Math.max(0, maxCount - mapped.length) }, (_, index) => ({
			id: `empty-${index + 1}`,
			isEmpty: true,
		}))

		return [...mapped, ...emptySlots]
	}, [hostUserId, identity?.sub, roomState?.maxParticipantCount, roomState?.participants])

	const nonEmptyPlayers = players.filter((player) => !player.isEmpty)
	const totalPlayers = roomState?.maxParticipantCount ?? players.length

	const currentUserPlayer = nonEmptyPlayers.find(
		(player) => Boolean(identity?.sub) && String(player.id) === identity.sub,
	)
	const currentUserReady = Boolean(currentUserPlayer?.isReady)
	const activeRoomCode = String(roomCode || requestedJoinCode || "").trim().toUpperCase()

	const leaveRoomAndReturnHome = useCallback(() => {
		if (!activeRoomCode) {
			navigate("/", { replace: true })
			return
		}

		leaveRoomMutation.mutate(activeRoomCode, {
			onSuccess: () => {
				pageLeaveSentRef.current = true
				navigate("/", { replace: true })
			},
		})
	}, [activeRoomCode, leaveRoomMutation, navigate])

	const handleStartGame = () => {
		if (!isHost) return
		if (!canStartGame) return
		if (isStartingGame) return

		setSetupError("")
		setIsStartingGame(true)
		emitGameStart(roomCode, (response) => {
			setIsStartingGame(false)
			if (!response?.ok || !response?.game) {
				const message = typeof response?.error === "string" ? response.error : "Unable to start game"
				setSetupError(message)
				return
			}

				navigate(`/game/${roomCode}`, { replace: true, state: { difficulty, soundMode: mode, roomCode } })
		})
	}

	const canStartGame = Boolean(isHost && roomState?.canStartGame)

	const handleCopyCode = async () => {
		if (!roomCode) return

		try {
			await navigator.clipboard.writeText(roomCode)
			setCopyState("success")
			if (copyResetTimerRef.current) {
				window.clearTimeout(copyResetTimerRef.current)
			}
			copyResetTimerRef.current = window.setTimeout(() => {
				setCopyState("idle")
				copyResetTimerRef.current = null
			}, 1800)
		} catch {
			setCopyState("error")
			if (copyResetTimerRef.current) {
				window.clearTimeout(copyResetTimerRef.current)
			}
			copyResetTimerRef.current = window.setTimeout(() => {
				setCopyState("idle")
				copyResetTimerRef.current = null
			}, 1800)
		}
	}

	const handleReady = () => {
		if (!roomCode) return
		setReadyMutation.mutate({ roomCode, isReady: !currentUserReady })
	}

	const errorMessage = setupError || (roomQueryError ? getApiErrorMessage(roomQueryError) : "")
	const isSettingUpRoom = joinRoomMutation.isPending
	const shouldShowRoomContent = !errorMessage && !isSettingUpRoom && !isRoomLoading && Boolean(roomCode)
	const user = getStoredAuthUser()
	const avatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const loginLabel = typeof user?.username === "string" ? user.username : "Login"

	useEffect(() => {
		if (!roomCode) return
		joinSocketRoom(roomCode)
	}, [roomCode])

	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) {
				window.clearTimeout(copyResetTimerRef.current)
			}
		}
	}, [])

	useEffect(() => {
		hasNavigatedToGameRef.current = false
	}, [roomCode])

	useEffect(() => {
		pageLeaveSentRef.current = false
	}, [activeRoomCode])

	useEffect(() => {
		if (!roomCode) return
		const socket = reconnectSocket()

		const maybeNavigateToGame = (gameState) => {
			const stateRoomCode = String(gameState?.roomCode ?? "").trim().toUpperCase()
			if (!stateRoomCode || stateRoomCode !== String(roomCode).toUpperCase()) return
			if (!gameState?.gameId) return
			if (gameState?.status === "finished") return

			// Only navigate players who are actually part of this server-side game.
			// This prevents late joiners (or non-participants) from being forced into
			// an in-progress game without ever clicking Skip during familiarization.
			if (!identity?.sub) return
			if (Array.isArray(gameState?.participantsOrder)) {
				const participantIds = gameState.participantsOrder.map((id) => String(id))
				if (!participantIds.includes(String(identity.sub))) return
			}
			if (Array.isArray(gameState?.eliminatedUserIds)) {
				const eliminatedIds = gameState.eliminatedUserIds.map((id) => String(id))
				if (eliminatedIds.includes(String(identity.sub))) return
			}

			if (hasNavigatedToGameRef.current) return
			hasNavigatedToGameRef.current = true
			navigate(`/game/${roomCode}`, { replace: true })
		}

		const requestStateOnce = () => {
			emitGameRequestState(roomCode, (response) => {
				if (response?.ok && response.game) maybeNavigateToGame(response.game)
			})
		}

		const onGameState = (gameState) => {
			maybeNavigateToGame(gameState)
		}
		const onConnect = () => {
			requestStateOnce()
		}

		socket.on("game_state", onGameState)
		socket.on("connect", onConnect)

		// If the game started before this client joined the socket room,
		// request current state once as a fallback.
		requestStateOnce()

		return () => {
			socket.off("game_state", onGameState)
			socket.off("connect", onConnect)
		}
	}, [identity?.sub, navigate, roomCode])

	return (
		<Background stickers={WAITING_ROOM_STICKERS}>
			<ErrorToast message={errorMessage} onDismiss={() => setSetupError("")} />
			<div className="min-h-screen">
				<header className="flex items-center justify-between px-8 py-5">
					<BrandLockup />
					<div className="flex items-center gap-3">
						<SoundToggleButton />
						<LoginButton avatarUrl={avatarUrl} label={loginLabel} />
						<Button
							type="button"
							onClick={leaveRoomAndReturnHome}
							variant="outline"
							className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted"
						>
							<LogOut className="size-4" />
							Leave Room
						</Button>
					</div>
				</header>

				<main className="mx-auto max-w-6xl px-6 pb-28">
					<h1 className="text-center text-4xl font-bold text-foreground md:text-5xl">Waiting Room</h1>

					{isSettingUpRoom || isRoomLoading ? (
						<p className="mt-4 text-center text-sm font-medium text-muted-foreground">Loading room...</p>
					) : null}

					{errorMessage ? (
						<div className="mt-4 text-center">
							<Button
								type="button"
								variant="outline"
								className="mt-4 rounded-full px-6 py-2 text-sm font-semibold"
								onClick={() => navigate("/")}
							>
								Back to Home
							</Button>
						</div>
					) : null}

					{shouldShowRoomContent ? (
						<>
							<div className="mt-6 flex flex-wrap items-center justify-center gap-4">
						<RoomPill>
							<span className="text-muted-foreground">Room Code:</span>
							<span className="text-lg font-bold text-primary">{roomCode}</span>
							<button
								type="button"
								onClick={handleCopyCode}
								className="cursor-pointer text-muted-foreground hover:text-foreground"
								aria-label="Copy room code"
								title={
									copyState === "success"
										? "Copied!"
										: copyState === "error"
											? "Copy failed"
											: "Copy room code"
								}
							>
								{copyState === "success" ? (
									<Check className="size-4 text-emerald-500" />
								) : (
									<Copy className="size-4" />
								)}
							</button>
							<span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
								{copyState === "success" ? "Copied" : copyState === "error" ? "Copy failed" : ""}
							</span>
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
									value={mode}
									disabled={!isHost}
									onChange={(next) => {
										if (!roomCode) return
										selectModeMutation.mutate({ roomCode, mode: next })
									}}
									options={[
										{ value: "bird", label: "Bird", Icon: BirdIcon },
										{ value: "piano", label: "Piano", Icon: Music },
										{ value: "maori", label: "Maori", Icon: Landmark },
										{ value: "animal", label: "Animal", Icon: PawPrint },
										{ value: "aussie", label: "Aussie", Icon: AussieIcon },
									]}
								/>
							</div>

							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</p>
								<SegmentedSelection
									value={difficulty}
									disabled={!isHost}
									onChange={(next) => {
										if (!roomCode) return
										selectDifficultyMutation.mutate({ roomCode, difficulty: next })
									}}
									options={[
										{ value: "easy", label: "Easy", Icon: CircleDot },
										{ value: "medium", label: "Normal", Icon: Zap },
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
								isCurrentUser={!player.isEmpty && Boolean(identity?.sub) && String(player.id) === identity.sub}
							/>
						))}
					</div>

					</>
				) : null}
				</main>
				{shouldShowRoomContent ? (
					<WaitingRoomActionBar
						isHost={isHost}
						canStartGame={canStartGame && !isStartingGame}
						currentUserReady={currentUserReady}
						isReadyPending={setReadyMutation.isPending}
						onStartGame={handleStartGame}
						onReady={handleReady}
					/>
				) : null}
			</div>
		</Background>
	)
}
