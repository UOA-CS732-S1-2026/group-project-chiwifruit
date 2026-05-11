import * as React from "react"

import { ArrowLeft, ChevronsRight } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import Background from "../components/Common/Background"
import { BACKGROUND_STICKERS } from "../components/Common/floatingStickerConfigs"
import ExitGameModal from "../components/Game/ExitGameModal"
import GamePlayerCard from "../components/Game/GamePlayerCard"
import GameResultsModal from "../components/Game/GameResultsModal"
import GameStatusBroadcast from "../components/Game/GameStatusBroadcast"
import GameWheel from "../components/Game/GameWheel"
import YoureOutModal from "../components/Game/YoureOutModal"
import LoginButton from "../components/AuthComponent/LoginButton"
import { Button } from "../components/ui/button"
import ErrorToast from "../components/ui/ErrorToast"
import { getStoredAuthUser } from "../api/axios"
import { leaveRoom } from "../api/rooms"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import useSoundStore from "../store/useSoundStore"
import { useRankingQuery } from "../hooks/queries/useRoomQuery"
import {
	emitGameFamiliarPadPress,
	emitGameFamiliarReady,
	emitGamePadPress,
	emitGameRequestState,
	joinSocketRoom,
	leaveSocketRoom,
	reconnectSocket,
} from "../socket/socket"
import { pickGameNoteUrls, playGameNote } from "../lib/gameAudio"

import logo from "../assets/branding/logo.png"
import { buildPadThemeSetByPadCount } from "../lib/gamePadPalette"

const PHASE = {
	FAMILIARIZE_AUTO: "familiarize:auto",
	FAMILIARIZE_FREE: "familiarize:free",
	FAMILIARIZE_WAITING: "familiarize:waiting",
	PLAYING: "playing",
}

const FAMILIARIZE_AUTOPLAY_MS = 2000
const FREE_PLAY_MS = 20_000
// const COUNTDOWN_MS = 5_000

function shouldExitToLanding(errorCode) {
	return errorCode === "GAME_NOT_PARTICIPANT" || errorCode === "NO_ACTIVE_GAME"
}

function coerceDifficulty(value) {
	if (value === "easy") return "easy"
	if (value === "hard") return "hard"
	return "medium"
}

export default function GamePage() {
	const navigate = useNavigate()
	const { roomCode: roomCodeParam = "" } = useParams()
	const roomCode = String(roomCodeParam).trim().toUpperCase()
	const lastFamiliarAutoPlayedPadRef = React.useRef({ gameId: null, index: null, at: 0 })
	const acknowledgedOutGameIdRef = React.useRef(null)
	const browserBackGuardArmedRef = React.useRef(false)
	const browserBackConfirmedRef = React.useRef(false)
// NOTE (2026-04-29): React 18 StrictMode + socket event timing can cause duplicate familiarization autoplay.
// Remote and local pad sound events may fire almost simultaneously, causing the same note to play twice.
// Using {gameId, index, at} for deduplication ensures each pad only plays once.
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

	const [socketGame, setSocketGame] = React.useState(null)
	const [socketError, setSocketError] = React.useState("")
	const [gameLoadError, setGameLoadError] = React.useState("")
	const [isGameLoading, setIsGameLoading] = React.useState(true)
	const [serverOffsetMs, setServerOffsetMs] = React.useState(0)
	const isSocketDriven = Boolean(socketGame?.gameId)
	const gamePlayers = React.useMemo(
		() => (Array.isArray(socketGame?.players) ? socketGame.players : []),
		[socketGame?.players],
	)
	const participantOrder = React.useMemo(
		() => {
			if (Array.isArray(socketGame?.participantsOrder) && socketGame.participantsOrder.length > 0) {
				return socketGame.participantsOrder.map(String)
			}
			return gamePlayers.map((player) => String(player.userId))
		},
		[socketGame?.participantsOrder, gamePlayers],
	)
	const currentGamePlayer = React.useMemo(() => {
		if (!currentUserId) return null
		return gamePlayers.find((player) => String(player.userId) === String(currentUserId)) ?? null
	}, [currentUserId, gamePlayers])
	const isCurrentUserActive = Boolean(currentGamePlayer && !currentGamePlayer.isEliminated && !currentGamePlayer.leftDuringGame)
	const waitingUserIds = React.useMemo(
		() => (Array.isArray(socketGame?.familiarReadyUserIds) ? socketGame.familiarReadyUserIds.map(String) : []),
		[socketGame?.familiarReadyUserIds],
	)
	const isCurrentUserWaiting = Boolean(isCurrentUserActive) && waitingUserIds.includes(String(currentUserId))

	React.useEffect(() => {
		// Browser limitation: we cannot show a custom React modal on refresh/close.
		// Use the native beforeunload confirmation for any in-game player during an active game.
		if (!isCurrentUserActive) return
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
	}, [isCurrentUserActive, isSocketDriven, socketGame?.status])

	React.useEffect(() => {
		if (roomCode) return
		navigate("/")
	}, [navigate, roomCode])

	const difficulty = React.useMemo(
		() => coerceDifficulty(socketGame?.difficulty),
		[socketGame?.difficulty],
	)
	const padCount = Number(socketGame?.padCount) > 0 ? Number(socketGame.padCount) : 0
	
// NOTE (2026-04-29): The audio list is generated only from socket-driven data (audioSeed + padCount).
// This avoids reshuffling from any non-authoritative client fallback state.
	const noteUrls = React.useMemo(() => {
		if (!isSocketDriven || !socketGame?.audioSeed) return []
		return pickGameNoteUrls({ 
			mode: socketGame.mode || "kiwi", 
			padCount, 
			seed: socketGame.audioSeed 
		})
	}, [isSocketDriven, socketGame?.audioSeed, socketGame?.mode, padCount])

	React.useEffect(() => {
		if (!roomCode) return
		if (!currentUserId) {
			setGameLoadError("Missing session. Please return to home and join again.")
			setIsGameLoading(false)
			navigate("/")
			return
		}

		let hasReceivedGameState = false
		setSocketError("")
		setGameLoadError("")
		setIsGameLoading(true)
		joinSocketRoom(roomCode)
		const socket = reconnectSocket()

		const onGameState = (nextState) => {
			hasReceivedGameState = true
			if (typeof nextState?.serverNow === "number") {
				setServerOffsetMs(nextState.serverNow - Date.now())
			}
			setSocketGame(nextState)
		}
		const onGameError = (payload) => {
			const message = typeof payload?.message === "string" ? payload.message : "Game error"
			setSocketError(message)
			if (!hasReceivedGameState) {
				setGameLoadError(message)
				setIsGameLoading(false)
			}
		}
		const onGamePadSound = (payload) => {
			if (socketGame?.status !== "playing") return
			const sourceUserId = typeof payload?.userId === "string" ? payload.userId : null
			if (sourceUserId && currentUserId && sourceUserId === currentUserId) return
			const padIndex = Number(payload?.padIndex)
			if (!Number.isInteger(padIndex) || padIndex < 0 || padIndex >= noteUrls.length) return
			playGameNote(noteUrls[padIndex])
			// NOTE (2026-04-29): The remote pad sound has already played once, so the automatic playback effect should not play again.
			lastFamiliarAutoPlayedPadRef.current = { gameId: null, index: padIndex, at: Date.now() }
			setActivePadIndex(padIndex)
			window.setTimeout(() => setActivePadIndex(null), 180)
		}

		socket.on("game_state", onGameState)
		socket.on("game_error", onGameError)
		socket.on("game_pad_sound", onGamePadSound)

		emitGameRequestState(roomCode, (response) => {
			if (response?.ok && response.game) {
				onGameState(response.game)
				setIsGameLoading(false)
				return
			}

			const errorCode = typeof response?.errorCode === "string" ? response.errorCode : ""
				const message = typeof response?.error === "string"
					? response.error
					: typeof response?.message === "string"
						? response.message
						: "Unable to load game"
				if (shouldExitToLanding(errorCode)) {
					leaveSocketRoom(roomCode)
					navigate("/")
					return
				}

			setGameLoadError(message)
			setIsGameLoading(false)
		})

		return () => {
			socket.off("game_state", onGameState)
			socket.off("game_error", onGameError)
			socket.off("game_pad_sound", onGamePadSound)
		}
	}, [currentUserId, navigate, noteUrls, roomCode, socketGame?.status])

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

	const [currentTurnIndex, setCurrentTurnIndex] = React.useState(0)
	const [turnSeconds, setTurnSeconds] = React.useState(20)
	const [isExitModalOpen, setIsExitModalOpen] = React.useState(false)
	const [isOutModalOpen, setIsOutModalOpen] = React.useState(false)
	const [isResultsModalOpen, setIsResultsModalOpen] = React.useState(false)
	const [isSpectating, setIsSpectating] = React.useState(false)
	const [broadcastEvent, setBroadcastEvent] = React.useState(null)
	const lastBroadcastEventKeyRef = React.useRef(null)
	const broadcastClearTimeoutRef = React.useRef(null)
	const rankingQuery = useRankingQuery(roomCode, isResultsModalOpen)
	const displayRanking = React.useMemo(() => {
		const ranking = Array.isArray(rankingQuery.data?.ranking) ? rankingQuery.data.ranking : []
		return ranking.map((player) => {
			const isCurrentUser = Boolean(currentUserId) && String(player?.userId) === currentUserId
			if (!isCurrentUser) return player

			return {
				...player,
				username: `${player.username} (You)`,
			}
		})
	}, [currentUserId, rankingQuery.data?.ranking])

	React.useEffect(() => {
		return () => {
			if (broadcastClearTimeoutRef.current) {
				window.clearTimeout(broadcastClearTimeoutRef.current)
			}
		}
	}, [])

	React.useEffect(() => {
		if (!socketGame) return
		const currentGameId = socketGame?.gameId ? String(socketGame.gameId) : null
		if (acknowledgedOutGameIdRef.current !== currentGameId) {
			acknowledgedOutGameIdRef.current = null
		}

		setSequence(Array.isArray(socketGame.sequence) ? socketGame.sequence : [])
		setInputCount(Number(socketGame.inputIndex ?? 0) || 0)
		setCurrentTurnIndex(Number(socketGame.currentTurnIndex ?? 0) || 0)

		const isOut = Boolean(currentGamePlayer && (currentGamePlayer.isEliminated || currentGamePlayer.leftDuringGame))
		setIsSpectating(isOut || Boolean(socketGame && !currentGamePlayer))

		if (socketGame.status === "finished") {
			setIsOutModalOpen(false)
			setIsExitModalOpen(false)
			setIsResultsModalOpen(true)
			return
		}

		if (isOut && currentGameId && acknowledgedOutGameIdRef.current !== currentGameId) {
			acknowledgedOutGameIdRef.current = currentGameId
			setIsOutModalOpen(true)
		}
		if (socketGame.status === "playing") setPhase(PHASE.PLAYING)
	}, [currentGamePlayer, socketGame])

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
		const gamePlayerList = Array.isArray(gamePlayers) ? gamePlayers : []
		if (gamePlayerList.length === 0) {
			return []
		}

		const playerById = new Map(gamePlayerList.map((player) => [String(player.userId), player]))
		const orderedIds = participantOrder.length > 0 ? participantOrder : gamePlayerList.map((player) => String(player.userId))

		const mapped = orderedIds
			.map((playerId) => {
				const player = playerById.get(String(playerId))
				if (!player) return null
				const isCurrentUser = Boolean(currentUserId) && String(playerId) === currentUserId
				return {
					id: String(playerId),
					name: isCurrentUser ? `${player.username} (You)` : player.username,
					avatarUrl: player.avatarUrl || (isCurrentUser ? headerAvatarUrl : undefined),
					score: Number(player.score ?? 0) || 0,
					isEliminated: Boolean(player.isEliminated),
					leftDuringGame: Boolean(player.leftDuringGame),
					status:
						Boolean(player.isEliminated) || Boolean(player.leftDuringGame)
							? "ELIMINATED"
							: "WAITING",
				}
			})
			.filter(Boolean)

		const leftCount = Math.ceil(mapped.length / 2)
		return mapped.map((player, index) => ({
			...player,
			side: index < leftCount ? "left" : "right",
		}))
	}, [currentUserId, headerAvatarUrl, gamePlayers, participantOrder])

	React.useEffect(() => {
		if (socketGame?.status) return
		acknowledgedOutGameIdRef.current = null
		setSequence([])
		setInputCount(0)
		setPhase(PHASE.FAMILIARIZE_AUTO)
		setAutoPlayIndex(0)
		setFreePlaySeconds(20)
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
	}, [currentTurnIndex, isOutModalOpen, isSpectating, phase, socketGame?.status, turnSeconds])

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

			{phase === PHASE.FAMILIARIZE_FREE && isCurrentUserActive ? (
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
		if (isSocketDriven && !isCurrentUserActive) return
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

	const exitRoomAndGameToHome = React.useCallback(() => {
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
	}, [navigate, roomCode])

	React.useEffect(() => {
		if (!isCurrentUserActive) {
			browserBackGuardArmedRef.current = false
			browserBackConfirmedRef.current = false
			return
		}
		if (!isSocketDriven) return
		if (!socketGame?.status || socketGame.status === "finished") return
		if (browserBackConfirmedRef.current) return

		if (!browserBackGuardArmedRef.current) {
			window.history.pushState({ gameBackGuard: true }, "", window.location.href)
			browserBackGuardArmedRef.current = true
		}

		const onPopState = () => {
			if (browserBackConfirmedRef.current) return

			const confirmed = window.confirm(
				"Going back now will forfeit the current game and remove you from this room. Continue?",
			)

			if (!confirmed) {
				window.history.pushState({ gameBackGuard: true }, "", window.location.href)
				return
			}

			browserBackConfirmedRef.current = true
			exitRoomAndGameToHome()
		}

		window.addEventListener("popstate", onPopState)
		return () => {
			window.removeEventListener("popstate", onPopState)
		}
	}, [exitRoomAndGameToHome, isCurrentUserActive, isSocketDriven, socketGame?.status])

	const padsDisabled =
		phase === PHASE.FAMILIARIZE_AUTO ||
		phase === PHASE.FAMILIARIZE_WAITING ||
		(phase === PHASE.PLAYING && Boolean(isSpectating)) ||
		(phase === PHASE.FAMILIARIZE_FREE && isCurrentUserWaiting) ||
		(isSocketDriven && !isCurrentUserActive) ||
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
		// NOTE (2026-04-29): Within a 250ms window, treat this as the same trigger (StrictMode/re-render/event jitter).
		if (last?.gameId === currentGameId && last?.index === activePadIndex && now - Number(last?.at ?? 0) < 250) {
			return
		}
		lastFamiliarAutoPlayedPadRef.current = { gameId: currentGameId, index: activePadIndex, at: now }
		playGameNote(noteUrls[activePadIndex])
	}, [activePadIndex, noteUrls, phase, socketGame?.gameId])

	const leftPlayers = players.filter((p) => p.side === "left")
	const rightPlayers = players.filter((p) => p.side === "right")
	const playerNameById = React.useMemo(
		() => new Map(players.map((player) => [String(player.id), player.name])),
		[players],
	)
	const isMyTurn =
		phase === PHASE.PLAYING &&
		Boolean(currentUserId) &&
		String(players[currentTurnIndex]?.id ?? "") === String(currentUserId)

	const showAddNote = inputCount >= sequence.length

	React.useEffect(() => {
		if (phase !== PHASE.PLAYING) {
			setBroadcastEvent(null)
			return
		}

		const event = socketGame?.lastEvent
		const eventKey = event
			? `${event.type}:${event.at ?? ""}:${event.userId ?? ""}:${event.reason ?? ""}`
			: null

		if (!eventKey || eventKey === lastBroadcastEventKeyRef.current) return
		lastBroadcastEventKeyRef.current = eventKey

		if (broadcastClearTimeoutRef.current) {
			window.clearTimeout(broadcastClearTimeoutRef.current)
			broadcastClearTimeoutRef.current = null
		}

		const actorUserId = event?.userId ? String(event.userId) : null
		const actorName = actorUserId ? playerNameById.get(actorUserId) ?? "Player" : null

		if (event?.type === "player_eliminated") {
			setBroadcastEvent({
				status: actorUserId && currentUserId && actorUserId === String(currentUserId) ? "out-self" : "out-other",
				actorName,
				reason: event.reason ?? null,
			})
			broadcastClearTimeoutRef.current = window.setTimeout(() => {
				setBroadcastEvent(null)
				broadcastClearTimeoutRef.current = null
			}, 2200)
			return
		}

		if (event?.type === "note_added") {
			setBroadcastEvent({ status: "turn-over", actorName, reason: null })
			broadcastClearTimeoutRef.current = window.setTimeout(() => {
				setBroadcastEvent(null)
				broadcastClearTimeoutRef.current = null
			}, 1800)
			return
		}

		setBroadcastEvent(null)
	}, [currentUserId, phase, playerNameById, socketGame?.lastEvent])

	if (!socketGame) {
		return (
			<Background>
				<ErrorToast message={gameLoadError} onDismiss={() => setGameLoadError("")} />
				<div className="flex min-h-screen items-center justify-center px-6 text-center">
					{gameLoadError && !isGameLoading ? (
						<div>
							<Button
								type="button"
								variant="outline"
								className="mt-4 rounded-full px-6 py-2 text-sm font-semibold"
								onClick={() => navigate(roomCode ? `/room/${roomCode}` : "/")}
							>
								Return
							</Button>
						</div>
					) : (
						<p className="text-sm font-semibold text-muted-foreground">Connecting to game...</p>
					)}
				</div>
			</Background>
		)
	}

	return (
		<Background stickers={BACKGROUND_STICKERS}>
			<ErrorToast
				message={socketError || gameLoadError}
				onDismiss={() => {
					setSocketError("")
					setGameLoadError("")
				}}
			/>
			<ExitGameModal
				open={isExitModalOpen}
				onCancel={() => setIsExitModalOpen(false)}
				onConfirm={() => {
					setIsExitModalOpen(false)
					// Exit Game leaves both the current match and the room roster.
					exitRoomAndGameToHome()
				}}
			/>
			<YoureOutModal
				open={isOutModalOpen}
				onKeepSpectating={() => {
					if (socketGame?.gameId) {
						acknowledgedOutGameIdRef.current = String(socketGame.gameId)
					}
					setIsOutModalOpen(false)
				}}
				onBackToWaitingRoom={() => {
					if (socketGame?.gameId) {
						acknowledgedOutGameIdRef.current = String(socketGame.gameId)
					}
					setIsOutModalOpen(false)
					navigate(roomCode ? `/room/${roomCode}` : "/")
				}}
			/>
			<GameResultsModal
				open={isResultsModalOpen}
				ranking={displayRanking}
				onClose={() => setIsResultsModalOpen(false)}
				onBackToRoom={() => {
					setIsResultsModalOpen(false)
					navigate(roomCode ? `/room/${roomCode}` : "/")
				}}
				onBackToHome={() => {
						// Returning home leaves both the room roster and the current match.
					setIsResultsModalOpen(false)
					exitRoomAndGameToHome()
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
									status={player.status}
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
							centerContent={<img src={logo} alt="Kichain" className="h-24 w-28 object-contain" />}
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
									status={player.status}
									isCurrentTurn={isCurrentTurn}
									turnSeconds={isCurrentTurn ? turnSeconds : undefined}
								/>
							)
						})}
					</div>
				</div>

				<GameStatusBroadcast
					phase={phase}
					players={players}
					currentTurnIndex={currentTurnIndex}
					inputCount={inputCount}
					sequenceLength={sequence.length}
					isMyTurn={isMyTurn}
					status={broadcastEvent?.status}
					actorName={broadcastEvent?.actorName}
					reason={broadcastEvent?.reason}
					currentUserName={currentGamePlayer?.username}
					className="mt-8"
				/>
			</div>
		</Background>
	)
}
