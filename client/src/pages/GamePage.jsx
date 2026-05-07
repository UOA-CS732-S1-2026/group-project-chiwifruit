import * as React from "react"

import { ArrowLeft, ChevronsRight } from "lucide-react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import Background from "../components/Common/Background"
import ExitGameModal from "../components/Game/ExitGameModal"
import GamePlayerCard from "../components/Game/GamePlayerCard"
import GameResultsModal from "../components/Game/GameResultsModal"
import GameStatusBroadcastSection from "../components/Game/GameStatusBroadcastSection"
import GameWheel from "../components/Game/GameWheel"
import YoureOutModal from "../components/Game/YoureOutModal"
import LoginButton from "../components/AuthComponent/LoginButton"
import { Button } from "../components/ui/button"
import { getStoredAuthUser } from "../api/axios"
import { leaveRoom } from "../api/rooms"
import { useRankingQuery, useRoomQuery } from "../hooks/queries/useRoomQuery"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import useSoundStore from "../store/useSoundStore"
import {
	emitGameFamiliarPadPress,
	emitGameFamiliarReady,
	emitGamePadPress,
	emitGameRequestState,
	emitGameStart,
	joinSocketRoom,
	leaveSocketRoom,
	reconnectSocket,
} from "../socket/socket"
import { pickGameNoteUrls, playGameNote } from "../lib/gameAudio"

import logo from "../assets/branding/logo.png"
import { buildPadThemeSetByPadCount, getPadCountByDifficulty } from "../lib/gamePadPalette"

const PHASE = {
	FAMILIARIZE_AUTO: "familiarize:auto",
	FAMILIARIZE_FREE: "familiarize:free",
	FAMILIARIZE_WAITING: "familiarize:waiting",
	PLAYING: "playing",
}

const FAMILIARIZE_AUTOPLAY_MS = 900
const FREE_PLAY_MS = 20_000
// const COUNTDOWN_MS = 5_000

function coerceDifficulty(value) {
	if (value === "easy") return "easy"
	if (value === "hard") return "hard"
	return "medium"
}

export default function GamePage() {
	const navigate = useNavigate()
	const location = useLocation()
	const { roomCode: roomCodeParam = "" } = useParams()
	const roomCode = String(roomCodeParam).trim().toUpperCase()
	const lastFamiliarAutoPlayedPadRef = React.useRef({ gameId: null, index: null, at: 0 })
	// NOTE (2026-04-29): React 18 StrictMode + socket event timing 会导致“熟悉阶段自动播放”
	// 与远端/本地 pad sound 事件几乎同时触发，从而出现同一个音重复播放。这里用
	// {gameId, index, at} 做去重，保证单次 pad 只响一次。
	const user = getStoredAuthUser()
	const headerAvatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const headerLoginLabel = typeof user?.username === "string" ? user.username : "Login"
	const currentUserId = user?.id ? String(user.id) : null

	// Game page rules:
	// - Force background music off.
	// - Force sound ON (unmuted), regardless of previous toggle.
	useBackgroundMusic({ enabled: false })
	const setMuted = useSoundStore((state) => state.setMuted)
	const muted = useSoundStore((state) => state.muted)
	React.useEffect(() => {
		setMuted(false)
	}, [setMuted])
	React.useEffect(() => {
		if (!muted) return
		setMuted(false)
	}, [muted, setMuted])

	const { data: roomState } = useRoomQuery(roomCode, Boolean(roomCode))
	const hostId = roomState?.hostId ? String(roomState.hostId) : null
	const isHost = Boolean(currentUserId) && Boolean(hostId) && currentUserId === hostId
	const canStartGame = Boolean(isHost && roomState?.canStartGame)
	const [socketGame, setSocketGame] = React.useState(null)
	const [socketError, setSocketError] = React.useState("")
	const [serverOffsetMs, setServerOffsetMs] = React.useState(0)
	const isSocketDriven = Boolean(socketGame?.gameId)
	const participantOrder = React.useMemo(
		() => (Array.isArray(socketGame?.participantsOrder) ? socketGame.participantsOrder.map(String) : []),
		[socketGame?.participantsOrder],
	)
	const isCurrentUserParticipant = Boolean(currentUserId) && participantOrder.includes(String(currentUserId))
	const waitingUserIds = React.useMemo(
		() => (Array.isArray(socketGame?.familiarReadyUserIds) ? socketGame.familiarReadyUserIds.map(String) : []),
		[socketGame?.familiarReadyUserIds],
	)
	const isCurrentUserWaiting = Boolean(isCurrentUserParticipant) && waitingUserIds.includes(String(currentUserId))

	React.useEffect(() => {
		// Browser limitation: we cannot show a custom React modal on refresh/close.
		// Use the native beforeunload confirmation for hosts during an active game.
		if (!isHost) return
		if (!isSocketDriven) return
		if (!socketGame?.status || socketGame.status === "finished") return

		const onBeforeUnload = (event) => {
			event.preventDefault()
			// Required for Chrome/Safari to show the confirmation dialog.
			event.returnValue = ""
			return ""
		}
		window.addEventListener("beforeunload", onBeforeUnload)
		return () => window.removeEventListener("beforeunload", onBeforeUnload)
	}, [isHost, isSocketDriven, socketGame?.status])

	React.useEffect(() => {
		if (!roomCode) return
		if (!canStartGame) return
		if (socketGame?.status) return
		emitGameStart(roomCode)
	}, [canStartGame, roomCode, socketGame?.status])

	React.useEffect(() => {
		if (roomCode) return
		navigate("/", { replace: true })
	}, [navigate, roomCode])

	const difficulty = React.useMemo(() => {
		if (socketGame?.difficulty) return coerceDifficulty(socketGame.difficulty)
		if (roomState?.difficulty) return coerceDifficulty(roomState.difficulty)
		return coerceDifficulty(location.state?.difficulty)
	}, [location.state?.difficulty, roomState?.difficulty, socketGame?.difficulty])
	const padCount = Number(socketGame?.padCount) > 0 ? Number(socketGame.padCount) : getPadCountByDifficulty(difficulty)

	// NOTE (2026-04-29): 音频列表只用 socket 驱动的数据生成（audioSeed + padCount）。
	// 原因：避免 roomState/location 变化导致重新洗牌，造成玩家两端音频映射不一致。
	const noteUrls = React.useMemo(() => {
		if (!isSocketDriven || !socketGame?.audioSeed) return []
		return pickGameNoteUrls({
			mode: socketGame.mode || "bird",
			padCount,
			seed: socketGame.audioSeed
		})
	}, [isSocketDriven, socketGame?.audioSeed, socketGame?.mode, padCount])

	React.useEffect(() => {
		if (!roomCode) return
		setSocketError("")
		joinSocketRoom(roomCode)
		const socket = reconnectSocket()

		const onGameState = (nextState) => {
			if (typeof nextState?.serverNow === "number") {
				setServerOffsetMs(nextState.serverNow - Date.now())
			}
			setSocketGame(nextState)
		}
		const onGameError = (payload) => {
			const message = typeof payload?.message === "string" ? payload.message : "Game error"
			setSocketError(message)
		}
		const onGamePadSound = (payload) => {
			const sourceUserId = typeof payload?.userId === "string" ? payload.userId : null
			if (sourceUserId && currentUserId && sourceUserId === currentUserId) return
			const padIndex = Number(payload?.padIndex)
			if (!Number.isInteger(padIndex) || padIndex < 0 || padIndex >= noteUrls.length) return
			playGameNote(noteUrls[padIndex])
			// NOTE (2026-04-29): 远端 pad sound 已经播放过一次，自动播放 effect 不应再次补播。
			lastFamiliarAutoPlayedPadRef.current = { gameId: null, index: padIndex, at: Date.now() }
			setActivePadIndex(padIndex)
			window.setTimeout(() => setActivePadIndex(null), 180)
		}

		socket.on("game_state", onGameState)
		socket.on("game_error", onGameError)
		socket.on("game_pad_sound", onGamePadSound)

		emitGameRequestState(roomCode, (response) => {
			if (response?.ok && response.game) onGameState(response.game)
		})

		return () => {
			socket.off("game_state", onGameState)
			socket.off("game_error", onGameError)
			socket.off("game_pad_sound", onGamePadSound)
		}
	}, [currentUserId, noteUrls, roomCode])

	const [phase, setPhase] = React.useState(PHASE.FAMILIARIZE_AUTO)
	const padThemes = React.useMemo(
		() => buildPadThemeSetByPadCount(padCount),
		// Recompute only when pad count changes.
		[padCount],
	)
	const [activePadIndex, setActivePadIndex] = React.useState(null)
	const [autoPlayIndex, setAutoPlayIndex] = React.useState(0)
	const [freePlaySeconds, setFreePlaySeconds] = React.useState(20)

	const [sequence, setSequence] = React.useState([])
	const [inputCount, setInputCount] = React.useState(0)
	const requiredInputCount = Math.max(1, sequence.length + 1)

	const [toastMessage, setToastMessage] = React.useState("Familiarize yourself with the notes!")
	React.useEffect(() => {
		if (!socketError) return
		setToastMessage(socketError)
	}, [socketError])

	React.useEffect(() => {
		if (!isSocketDriven) return
		if (phase === PHASE.FAMILIARIZE_AUTO || phase === PHASE.FAMILIARIZE_FREE) {
			setToastMessage("Familiarize yourself with the notes!")
			return
		}
		if (phase === PHASE.FAMILIARIZE_WAITING) {
			setToastMessage("Waiting for other players to get ready...")
			return
		}
		if (phase === PHASE.PLAYING) {
			setToastMessage("Game started! Follow the sequence.")
		}
	}, [isSocketDriven, phase])

	const [currentTurnIndex, setCurrentTurnIndex] = React.useState(0)
	const [turnSeconds, setTurnSeconds] = React.useState(20)
	const [isExitModalOpen, setIsExitModalOpen] = React.useState(false)
	const [isOutModalOpen, setIsOutModalOpen] = React.useState(false)
	const [isResultsModalOpen, setIsResultsModalOpen] = React.useState(false)
	const [isSpectating, setIsSpectating] = React.useState(false)

	React.useEffect(() => {
		if (!socketGame) return
		setSequence(Array.isArray(socketGame.sequence) ? socketGame.sequence : [])
		setInputCount(Number(socketGame.inputIndex ?? 0) || 0)
		setCurrentTurnIndex(Number(socketGame.currentTurnIndex ?? 0) || 0)

		const eliminated = Array.isArray(socketGame.eliminatedUserIds) ? socketGame.eliminatedUserIds : []
		const isEliminated = Boolean(currentUserId) && eliminated.includes(currentUserId)
		setIsSpectating(isEliminated)

		if (socketGame.status === "finished") {
			setIsOutModalOpen(false)
			setIsExitModalOpen(false)
			setIsResultsModalOpen(true)
			return
		}

		if (isEliminated) setIsOutModalOpen(true)
		if (socketGame.status === "playing") setPhase(PHASE.PLAYING)
	}, [currentUserId, socketGame])

	React.useEffect(() => {
		if (!isSocketDriven) return
		const startedAt = Number(socketGame?.startedAt)
		if (!Number.isFinite(startedAt) || startedAt <= 0) return

		const autoEndsAt = startedAt + padCount * FAMILIARIZE_AUTOPLAY_MS
		const freeEndsAt = autoEndsAt + FREE_PLAY_MS

		const intervalId = window.setInterval(() => {
			const now = Date.now() + serverOffsetMs
			if (socketGame.status === "playing") {
				setPhase(PHASE.PLAYING)
				return
			}

			if (now < autoEndsAt) {
				setPhase(PHASE.FAMILIARIZE_AUTO)
				const nextIndex = Math.min(padCount - 1, Math.max(0, Math.floor((now - startedAt) / FAMILIARIZE_AUTOPLAY_MS)))
				setAutoPlayIndex(nextIndex)
				setActivePadIndex(nextIndex)
				return
			}

			setActivePadIndex(null)
			setAutoPlayIndex(Math.max(0, padCount - 1))

			if (isCurrentUserWaiting) {
				setPhase(PHASE.FAMILIARIZE_WAITING)
				setFreePlaySeconds(Math.max(0, Math.ceil((freeEndsAt - now) / 1000)))
				return
			}

			setPhase(PHASE.FAMILIARIZE_FREE)
			setFreePlaySeconds(Math.max(0, Math.ceil((freeEndsAt - now) / 1000)))
		}, 100)

		return () => window.clearInterval(intervalId)
	}, [isCurrentUserWaiting, isSocketDriven, padCount, serverOffsetMs, socketGame?.startedAt, socketGame?.status])

	React.useEffect(() => {
		if (!socketGame?.turnEndsAt) return
		if (socketGame.status !== "playing") return
		const intervalId = window.setInterval(() => {
			const now = Date.now() + serverOffsetMs
			const secondsLeft = Math.max(0, Math.ceil((Number(socketGame.turnEndsAt) - now) / 1000))
			setTurnSeconds(secondsLeft)
		}, 250)
		return () => window.clearInterval(intervalId)
	}, [serverOffsetMs, socketGame?.status, socketGame?.turnEndsAt])

	const players = React.useMemo(() => {
		const participants = Array.isArray(roomState?.participants) ? roomState.participants : []
		if (participants.length === 0) {
			return [
				{
					id: currentUserId ?? "me",
					name: `${headerLoginLabel} (You)`,
					avatarUrl: headerAvatarUrl,
					score: 0,
					side: "left",
				},
			]
		}

		// Important: order must match the server-authoritative participantsOrder so that
		// currentTurnIndex highlights the correct player.
		const participantById = new Map(participants.map((participant) => [String(participant.userId), participant]))
		const orderedIds = participantOrder.length > 0 ? participantOrder : participants.map((p) => String(p.userId))

		const mapped = orderedIds
			.map((participantId) => {
				const participant = participantById.get(String(participantId))
				if (!participant) return null
				const isCurrentUser = Boolean(currentUserId) && String(participantId) === currentUserId
				const backendAvatarUrl = typeof participant.avatarUrl === "string" ? participant.avatarUrl : undefined
				const scoreFromSocket =
					socketGame?.scores && String(participantId) in socketGame.scores
						? Number(socketGame.scores[String(participantId)])
						: null
				return {
					id: String(participantId),
					name: isCurrentUser ? `${participant.username} (You)` : participant.username,
					avatarUrl: backendAvatarUrl ?? (isCurrentUser ? headerAvatarUrl : undefined),
					score: (Number.isFinite(scoreFromSocket) ? scoreFromSocket : Number(participant.correctCount ?? 0)) || 0,
				}
			})
			.filter(Boolean)

		const leftCount = Math.ceil(mapped.length / 2)
		return mapped.map((player, index) => ({
			...player,
			side: index < leftCount ? "left" : "right",
		}))
	}, [currentUserId, headerAvatarUrl, headerLoginLabel, participantOrder, roomState?.participants, socketGame?.scores])

	const { data: rankingData } = useRankingQuery(roomCode, Boolean(roomCode) && isResultsModalOpen)
	const resultsPlayers = React.useMemo(() => {
		const entries = Array.isArray(rankingData?.ranking) ? rankingData.ranking : []
		if (entries.length === 0) return players
		return entries.map((entry) => {
			const entryId = String(entry.userId)
			const isCurrentUser = Boolean(currentUserId) && entryId === currentUserId
			const backendAvatarUrl = typeof entry.avatarUrl === "string" ? entry.avatarUrl : undefined
			return {
				id: entryId,
				name: isCurrentUser ? `${entry.username} (You)` : entry.username,
				score: Number(entry.correctCount ?? 0) || 0,
				avatarUrl: backendAvatarUrl ?? (isCurrentUser ? headerAvatarUrl : undefined),
			}
		})
	}, [currentUserId, headerAvatarUrl, players, rankingData?.ranking])

	React.useEffect(() => {
		if (socketGame?.status) return
		setSequence([])
		setInputCount(0)
		setPhase(PHASE.FAMILIARIZE_AUTO)
		setAutoPlayIndex(0)
		setFreePlaySeconds(20)
		setToastMessage("Familiarize yourself with the notes!")
		setCurrentTurnIndex(0)
		setTurnSeconds(20)
		setIsExitModalOpen(false)
		setIsOutModalOpen(false)
		setIsResultsModalOpen(false)
		setIsSpectating(false)
	}, [socketGame?.status])

	React.useEffect(() => {
		setCurrentTurnIndex((previous) => (previous >= players.length ? 0 : previous))
	}, [players.length])

	React.useEffect(() => {
		if (phase !== PHASE.PLAYING) return
		if (socketGame?.status === "playing") return
		if (isOutModalOpen) return
		if (isSpectating) return
		if (currentTurnIndex !== 0) return
		if (turnSeconds !== 0) return

		setIsSpectating(true)
		setIsOutModalOpen(true)
		setToastMessage("You're out! You can keep spectating.")
	}, [currentTurnIndex, isOutModalOpen, isSpectating, phase, socketGame?.status, turnSeconds])

	React.useEffect(() => {
		if (isSocketDriven) return
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
	}, [isSocketDriven, padCount, phase])

	React.useEffect(() => {
		if (isSocketDriven) return
		if (phase !== PHASE.FAMILIARIZE_AUTO) return
		setActivePadIndex(autoPlayIndex)
	}, [autoPlayIndex, isSocketDriven, phase])

	React.useEffect(() => {
		if (isSocketDriven) return
		if (phase !== PHASE.FAMILIARIZE_FREE) return
		setToastMessage("Familiarize yourself with the notes!")
		setFreePlaySeconds(20)

		const intervalId = window.setInterval(() => {
			setFreePlaySeconds((previous) => {
				return Math.max(0, previous - 1)
			})
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [isSocketDriven, phase])

	React.useEffect(() => {
		if (phase !== PHASE.PLAYING) return
		if (socketGame?.status === "playing") return
		setTurnSeconds(20)

		const intervalId = window.setInterval(() => {
			setTurnSeconds((previous) => Math.max(0, previous - 1))
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [currentTurnIndex, phase, socketGame?.status])

	const isFamiliarize =
		phase === PHASE.FAMILIARIZE_AUTO || phase === PHASE.FAMILIARIZE_FREE || phase === PHASE.FAMILIARIZE_WAITING

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
						) : phase === PHASE.FAMILIARIZE_WAITING ? (
							<span className="text-[14px] leading-5 text-[#00bba7]">Waiting for other players...</span>
						) : (
							<>
								<span className="text-[12px] leading-4">Free play ends in </span>
								<span className="text-[14px] leading-5 text-[#00bba7]">
									{`${freePlaySeconds}s`}
								</span>
							</>
						)}
					</p>
				</div>
			</div>

			{phase === PHASE.FAMILIARIZE_FREE && isCurrentUserParticipant ? (
				<button
					type="button"
					onClick={() => {
						if (!isSocketDriven) return
						emitGameFamiliarReady(roomCode)
					}}
					className="inline-flex items-center justify-center gap-1 text-center text-[10px] font-bold leading-[15px] tracking-[1px] text-[#90a1b9] uppercase"
				>
					<span>Click to Skip</span>
					<ChevronsRight className="size-3" />
				</button>
			) : null}
		</div>
	) : null

	const handlePadPress = (index) => {
		if (isSocketDriven && !isCurrentUserParticipant) return
		if (phase === PHASE.FAMILIARIZE_AUTO) return
		if (phase === PHASE.FAMILIARIZE_WAITING) return
		if (phase === PHASE.PLAYING && isSpectating) return
		if (phase === PHASE.FAMILIARIZE_FREE && isCurrentUserWaiting) return
		if (phase === PHASE.PLAYING && socketGame?.status === "playing") {
			if (!currentUserId) return
			if (socketGame.currentTurnUserId && currentUserId !== socketGame.currentTurnUserId) return
		}

		setActivePadIndex(index)
		window.setTimeout(() => setActivePadIndex(null), 180)
		playGameNote(noteUrls[index])

		if (socketGame?.status === "familiarizing" && phase === PHASE.FAMILIARIZE_FREE) {
			emitGameFamiliarPadPress(roomCode, index)
			return
		}

		if (socketGame?.status === "playing" && phase === PHASE.PLAYING) {
			// Server-authoritative: send input to backend.
			emitGamePadPress(roomCode, index)
			return
		}
	}

	const padsDisabled =
		phase === PHASE.FAMILIARIZE_AUTO ||
		phase === PHASE.FAMILIARIZE_WAITING ||
		(phase === PHASE.PLAYING && Boolean(isSpectating)) ||
		(phase === PHASE.FAMILIARIZE_FREE && isCurrentUserWaiting) ||
		(phase === PHASE.PLAYING &&
			socketGame?.status === "playing" &&
			(Boolean(!currentUserId) || (socketGame.currentTurnUserId && currentUserId !== socketGame.currentTurnUserId)))

	React.useEffect(() => {
		if (phase !== PHASE.FAMILIARIZE_AUTO) return
		if (activePadIndex == null) return
		if (activePadIndex < 0 || activePadIndex >= noteUrls.length) return

		const now = Date.now()
		const currentGameId = socketGame?.gameId ? String(socketGame.gameId) : null
		const last = lastFamiliarAutoPlayedPadRef.current
		// NOTE (2026-04-29): 250ms 窗口内认为是同一次触发（StrictMode/重复渲染/事件抖动）。
		if (last?.gameId === currentGameId && last?.index === activePadIndex && now - Number(last?.at ?? 0) < 250) {
			return
		}
		lastFamiliarAutoPlayedPadRef.current = { gameId: currentGameId, index: activePadIndex, at: now }
		playGameNote(noteUrls[activePadIndex])
	}, [activePadIndex, noteUrls, phase, socketGame?.gameId])

	const leftPlayers = players.filter((p) => p.side === "left")
	const rightPlayers = players.filter((p) => p.side === "right")

	const showAddNote = inputCount >= sequence.length

	if (!socketGame) {
		return (
			<Background>
				<div className="flex min-h-screen items-center justify-center px-6 text-center">
					<p className="text-sm font-semibold text-muted-foreground">Connecting to game...</p>
				</div>
			</Background>
		)
	}

	return (
		<Background>
			<ExitGameModal
				open={isExitModalOpen}
				onCancel={() => setIsExitModalOpen(false)}
				onConfirm={() => {
					setIsExitModalOpen(false)
					if (roomCode) leaveSocketRoom(roomCode)
					navigate(roomCode ? `/room/${roomCode}` : "/")
				}}
			/>
			<YoureOutModal
				open={isOutModalOpen}
				onKeepSpectating={() => setIsOutModalOpen(false)}
				onBackToWaitingRoom={() => {
					setIsOutModalOpen(false)
					navigate(roomCode ? `/room/${roomCode}` : "/")
				}}
			/>
			<GameResultsModal
				open={isResultsModalOpen}
				players={resultsPlayers}
				onClose={() => setIsResultsModalOpen(false)}
				onBackToRoom={() => {
					setIsResultsModalOpen(false)
					navigate(roomCode ? `/room/${roomCode}` : "/")
				}}
				onBackToHome={() => {
					// NOTE (2026-04-29): “回首页”必须先 REST leaveRoom，让其他玩家看到你离开。
					// socket 的 leave_room 语义是“离开比赛=直接判负”，这里只是离开房间名单。
					setIsResultsModalOpen(false)
					if (!roomCode) {
						navigate("/")
						return
					}
					Promise.resolve()
						.then(() => leaveRoom(roomCode))
						.catch(() => null)
						.finally(() => {
							leaveSocketRoom(roomCode)
							navigate("/")
						})
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
						<div className="flex items-center gap-3">
							<LoginButton avatarUrl={headerAvatarUrl} label={headerLoginLabel} />
						</div>
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
									avatarUrl={player.avatarUrl}
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
							disabled={padsDisabled}
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
									avatarUrl={player.avatarUrl}
									score={player.score}
									status="WAITING"
									isCurrentTurn={isCurrentTurn}
									turnSeconds={isCurrentTurn ? turnSeconds : undefined}
								/>
							)
						})}
					</div>
				</div>

				<GameStatusBroadcastSection
					phase={phase}
					players={players}
					currentTurnIndex={currentTurnIndex}
					turnSeconds={turnSeconds}
					inputCount={inputCount}
					requiredInputCount={requiredInputCount}
					sequence={sequence}
					autoPlayIndex={autoPlayIndex}
					padCount={padCount}
					freePlaySeconds={freePlaySeconds}
					isSpectating={isSpectating}
					currentUserId={currentUserId}
					toastMessage={toastMessage}
					className="mt-8"
				/>
			</div>
		</Background>
	)
}
