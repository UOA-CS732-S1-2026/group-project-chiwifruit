import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Check, CircleDot, Copy, Flame, LogOut, Music, Play, Users, Zap } from "lucide-react"

import Background from "../components/Common/Background"
import BrandLockup from "../components/Common/BrandLockup"
import LoginButton from "../components/AuthComponent/LoginButton"
import RoomPill from "../components/Room/RoomPill"
import RoomSectionLabel from "../components/Room/RoomSectionLabel"
import SegmentedSelection from "../components/Room/SegmentedSelection"
import PlayerSlotCard from "../components/Room/PlayerSlotCard"
import { Button } from "../components/ui/button"
import SoundToggleButton from "../components/ui/SoundToggleButton"
import {
	useJoinRoomMutation,
	useLeaveRoomMutation,
	useSelectDifficultyMutation,
	useSelectModeMutation,
	useSetReadyMutation,
} from "../hooks/mutations/useRoomMutations"
import { useRoomQuery } from "../hooks/queries/useRoomQuery"
import { getApiErrorMessage, getStoredAuthUser } from "../api/axios"

import birdIcon from "../assets/icons/bird.svg"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import { emitGameRequestState, emitGameStart, joinSocketRoom, leaveSocketRoom, reconnectSocket } from "../socket/socket"

// NOTE (2026-04-29): Waiting Room 页面同时依赖两类机制：
// - REST: join/leave room, ready/mode/difficulty 等“房间成员列表/配置”
// - Socket: 订阅 room_update / game_state 等实时广播，并在游戏开始时自动跳转
// 重点：离开等待房间请走 REST leaveRoom；socket leave_room 在本项目语义是“离开比赛=判负”。

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
	const { roomCode: roomCodeParam = "" } = useParams()
	// Background music is enabled on Landing + Room pages.
	useBackgroundMusic()

	const normalizedParamCode = String(roomCodeParam).trim().toUpperCase()
	const requestedJoinCode = normalizedParamCode === "NEW" ? "" : normalizedParamCode
	const [roomCode, setRoomCode] = useState("")
	const [setupError, setSetupError] = useState("")

	const startedSetupRef = useRef(false)
	const hasNavigatedToGameRef = useRef(false)

	useEffect(() => {
		startedSetupRef.current = false
		setSetupError("")
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

		joinRoomMutation.mutate(requestedJoinCode)
	}, [joinRoomMutation, navigate, requestedJoinCode])

	const { data: roomState, isLoading: isRoomLoading, error: roomQueryError } = useRoomQuery(
		roomCode,
		Boolean(roomCode),
	)

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

	const handleStartGame = () => {
		if (!isHost) return
		if (!canStartGame) return
		emitGameStart(roomCode)
		navigate(`/game/${roomCode}`, { state: { difficulty, soundMode: mode, roomCode } })
	}

	const canStartGame = Boolean(isHost && roomState?.canStartGame)

	const handleCopyCode = async () => {
		if (!roomCode) return
		try {
			await navigator.clipboard.writeText(roomCode)
		} catch {
			// no-op: clipboard can fail without user gesture / permissions
		}
	}

	const handleReady = () => {
		if (!roomCode) return
		setReadyMutation.mutate({ roomCode, isReady: !currentUserReady })
	}

	const errorMessage = setupError || (roomQueryError ? getApiErrorMessage(roomQueryError) : "")
	const isSettingUpRoom = joinRoomMutation.isPending
	const user = getStoredAuthUser()
	const avatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const loginLabel = typeof user?.username === "string" ? user.username : "Login"

	useEffect(() => {
		if (!roomCode) return
		joinSocketRoom(roomCode)
	}, [roomCode])

	useEffect(() => {
		hasNavigatedToGameRef.current = false
	}, [roomCode])

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
			navigate(`/game/${roomCode}`)
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
		<Background>
			<div className="min-h-screen">
				<header className="flex items-center justify-between px-8 py-5">
					<BrandLockup />
					<div className="flex items-center gap-3">
						<SoundToggleButton />
						<LoginButton avatarUrl={avatarUrl} label={loginLabel} />
						<Button
							type="button"
							onClick={() => {
								if (!roomCode) {
									navigate("/")
									return
								}
										// NOTE (2026-04-29): 先 REST leaveRoom() 确保从 participants 移除并广播 room_update；
										// 然后再发 socket leave_room（用于 game-side 的“离开比赛”语义）。
								leaveRoomMutation.mutate(roomCode, {
									onSuccess: () => {
										leaveSocketRoom(roomCode)
										navigate("/")
									},
								})
							}}
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

					{isSettingUpRoom || isRoomLoading ? (
						<p className="mt-4 text-center text-sm font-medium text-muted-foreground">Loading room...</p>
					) : null}

					{errorMessage ? (
						<p className="mt-4 text-center text-sm font-semibold text-destructive">{errorMessage}</p>
					) : null}

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
									value={mode}
									disabled={!isHost}
									onChange={(next) => {
										if (!roomCode) return
										selectModeMutation.mutate({ roomCode, mode: next })
									}}
									options={[
										{ value: "bird", label: "Kiwi", Icon: BirdIcon },
										{ value: "piano", label: "Piano", Icon: Music },
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
								disabled={setReadyMutation.isPending}
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
