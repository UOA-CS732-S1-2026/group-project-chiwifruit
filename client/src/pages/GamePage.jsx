import * as React from "react"

import { ArrowLeft, ChevronsRight } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
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
import { useJoinRoomMutation } from "../hooks/mutations/useRoomMutations"
import useSoundStore from "../store/useSoundStore"
import { useRankingQuery, useRoomQuery } from "../hooks/queries/useRoomQuery"
import {
	emitGameFamiliarTiming,
	emitGameFamiliarPadPress,
	emitGameFamiliarReady,
	emitGamePadPress,
	emitGameRequestState,
	joinSocketRoom,
	leaveSocketRoom,
	reconnectSocket,
} from "../socket/socket"
import SOCKET_EVENTS from "../socket/socketEvents"
import { getGameNoteDurationMs, pickGameNoteUrls, playGameNote, playGameNoteAsync, stopGameNote } from "../lib/gameAudio"
import { COUNTDOWN_URGENT_THRESHOLD_SECONDS } from "../lib/gameConstants"
import { playCountdownTickSfx } from "../lib/sound"

import logo from "../assets/branding/logo.png"
import { buildPadThemeSetByPadCount } from "../lib/gamePadPalette"

const PHASE = {
	FAMILIARIZE_AUTO: "familiarize:auto",
	FAMILIARIZE_FREE: "familiarize:free",
	FAMILIARIZE_WAITING: "familiarize:waiting",
	PLAYING: "playing",
}

const FAMILIARIZE_AUTOPLAY_GAP_MS = 1000
const FREE_PLAY_MS = 20_000
const AUTOPLAY_DEDUPE_WINDOW_MS = 400
const recentAutoplayPlays = new Map()
// const COUNTDOWN_MS = 5_000

function shouldSkipDuplicateAutoplay(gameId, padIndex) {
	if (!gameId || !Number.isInteger(padIndex)) return false

	const now = Date.now()
	const autoplayKey = `${String(gameId)}:${padIndex}`
	const lastPlayedAt = recentAutoplayPlays.get(autoplayKey)

	for (const [key, playedAt] of recentAutoplayPlays.entries()) {
		if (now - playedAt > AUTOPLAY_DEDUPE_WINDOW_MS) {
			recentAutoplayPlays.delete(key)
		}
	}

	if (typeof lastPlayedAt === "number" && now - lastPlayedAt < AUTOPLAY_DEDUPE_WINDOW_MS) {
		return true
	}

	recentAutoplayPlays.set(autoplayKey, now)
	return false
}

function waitForMs(ms) {
	const safeDelay = Math.max(0, Number(ms) || 0)
	if (safeDelay === 0) return Promise.resolve()
	return new Promise((resolve) => {
		window.setTimeout(resolve, safeDelay)
	})
}

function shouldExitToLanding(errorCode) {
	return errorCode === "GAME_NOT_PARTICIPANT" || errorCode === "NO_ACTIVE_GAME"
}

function coerceDifficulty(value) {
	if (value === "easy") return "easy"
	if (value === "hard") return "hard"
	return "medium"
}

export default function GamePage() {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const { roomCode: roomCodeParam = "" } = useParams()
	const roomCode = String(roomCodeParam).trim().toUpperCase()
	const acknowledgedOutGameIdRef = React.useRef(null)
	const lastCountdownSfxSecondRef = React.useRef(null)
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
	const [noteDurationsMs, setNoteDurationsMs] = React.useState([])
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

	const navigateHomeWithError = React.useCallback(
		(message) => {
			navigate("/", {
				replace: true,
				state: message
					? {
						errorMessage: message,
					}
					: undefined,
			})
		},
		[navigate],
	)

	const requestLatestGameState = React.useCallback(() => {
		if (!roomCode) return

		emitGameRequestState(roomCode, (response) => {
			if (response?.ok && response.game) {
				if (typeof response.game?.serverNow === "number") {
					setServerOffsetMs(response.game.serverNow - Date.now())
				}
				setSocketGame(response.game)
				setIsGameLoading(false)
				return
			}

			const errorCode = typeof response?.errorCode === "string" ? response.errorCode : ""
			const message =
				typeof response?.error === "string"
					? response.error
					: typeof response?.message === "string"
						? response.message
						: "Unable to load game"

			if (shouldExitToLanding(errorCode)) {
				leaveSocketRoom(roomCode)
				navigateHomeWithError(
					errorCode === "NO_ACTIVE_GAME" ? "This game no longer exists." : message,
				)
				return
			}

			setGameLoadError(message)
			setIsGameLoading(false)
		})
	}, [navigateHomeWithError, roomCode])

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
		navigateHomeWithError()
	}, [navigateHomeWithError, roomCode])

	const difficulty = React.useMemo(
		() => coerceDifficulty(socketGame?.difficulty),
		[socketGame?.difficulty],
	)
	const padCount = Number(socketGame?.padCount) > 0 ? Number(socketGame.padCount) : 0
	const [noteUrls, setNoteUrls] = React.useState([])
	
// NOTE (2026-04-29): The audio list is generated only from socket-driven data (audioSeed + padCount).
// This avoids reshuffling from any non-authoritative client fallback state.
	React.useEffect(() => {
		if (!isSocketDriven || !socketGame?.audioSeed || padCount <= 0) {
			setNoteUrls([])
			return
		}

		let isCancelled = false

		void pickGameNoteUrls({
			mode: socketGame.mode || "kiwi",
			padCount,
			seed: socketGame.audioSeed,
		})
			.then((nextNoteUrls) => {
				if (isCancelled) return
				setNoteUrls(Array.isArray(nextNoteUrls) ? nextNoteUrls : [])
			})
			.catch(() => {
				if (isCancelled) return
				setNoteUrls([])
			})

		return () => {
			isCancelled = true
		}
	}, [isSocketDriven, socketGame?.audioSeed, socketGame?.mode, padCount])

	React.useEffect(() => {
		if (!roomCode) return
		if (!currentUserId) {
			setGameLoadError("Missing session. Please return to home and join again.")
			setIsGameLoading(false)
			navigateHomeWithError("Missing session. Please join again.")
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
			setActivePadIndex(padIndex)
			window.setTimeout(() => setActivePadIndex(null), 180)
		}

		socket.on("game_state", onGameState)
		socket.on("game_error", onGameError)
		socket.on("game_pad_sound", onGamePadSound)

		requestLatestGameState()

		return () => {
			socket.off("game_state", onGameState)
			socket.off("game_error", onGameError)
			socket.off("game_pad_sound", onGamePadSound)
		}
	}, [currentUserId, navigateHomeWithError, noteUrls, requestLatestGameState, roomCode, socketGame?.status])

	React.useEffect(() => {
		if (!roomCode || !currentUserId) return

		const onPageShow = (event) => {
			if (!event.persisted) return

			setSocketError("")
			setGameLoadError("")
			setSocketGame(null)
			setIsGameLoading(true)
			setIsExitModalOpen(false)
			setIsOutModalOpen(false)
			setIsResultsModalOpen(false)
			setIsSpectating(false)
			reconnectSocket()
			requestLatestGameState()
		}

		window.addEventListener("pageshow", onPageShow)
		return () => {
			window.removeEventListener("pageshow", onPageShow)
		}
	}, [currentUserId, requestLatestGameState, roomCode])

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
	const resultsRejoinAttemptRef = React.useRef(null)
	const joinRoomMutation = useJoinRoomMutation({
		onSuccess: (_, joinedRoomCode) => {
			queryClient.invalidateQueries({ queryKey: ["room", String(joinedRoomCode).trim().toUpperCase()] })
		},
	})
	const familiarAutoDurationMs = React.useMemo(() => {
		const rawServerDuration = socketGame?.familiarAutoDurationMs
		if (rawServerDuration !== null && rawServerDuration !== undefined) {
			const serverDuration = Number(rawServerDuration)
			if (Number.isFinite(serverDuration) && serverDuration >= 0) {
				return serverDuration
			}
		}
		if (!Array.isArray(noteDurationsMs) || noteDurationsMs.length === 0) {
			return padCount > 0 ? padCount * FAMILIARIZE_AUTOPLAY_GAP_MS : 0
		}
		return noteDurationsMs.reduce((total, duration, index) => {
			const safeDuration = Math.max(0, Number(duration) || 0)
			const gapMs = index < noteDurationsMs.length - 1 ? FAMILIARIZE_AUTOPLAY_GAP_MS : 0
			return total + safeDuration + gapMs
		}, 0)
	}, [noteDurationsMs, padCount, socketGame?.familiarAutoDurationMs])
	const rankingQuery = useRankingQuery(roomCode, isResultsModalOpen)
	const roomStateQuery = useRoomQuery(roomCode, isResultsModalOpen)
	const displayRanking = React.useMemo(() => {
		const ranking = Array.isArray(rankingQuery.data?.ranking) ? rankingQuery.data.ranking : []
		const participantIds = new Set(
			Array.isArray(roomStateQuery.data?.participants)
				? roomStateQuery.data.participants.map((participant) => String(participant.userId))
				: [],
		)
		return ranking.map((player) => {
			const isCurrentUser = Boolean(currentUserId) && String(player?.userId) === currentUserId
			const playerId = player?.userId ? String(player.userId) : null
			const basePlayer = {
				...player,
				isOnline: playerId ? participantIds.has(playerId) : false,
			}
			if (!isCurrentUser) return basePlayer

			return {
				...basePlayer,
				username: `${player.username} (You)`,
			}
		})
	}, [currentUserId, rankingQuery.data?.ranking, roomStateQuery.data?.participants])

	React.useEffect(() => {
		if (isResultsModalOpen) return
		resultsRejoinAttemptRef.current = null
	}, [isResultsModalOpen])

	React.useEffect(() => {
		resultsRejoinAttemptRef.current = null
	}, [roomCode, socketGame?.gameId])

	React.useEffect(() => {
		if (!isResultsModalOpen) return
		if (!roomCode) return

		const normalizedRoomCode = String(roomCode).trim().toUpperCase()
		const socket = reconnectSocket()

		const onRoomUpdate = (nextRoomState) => {
			const nextRoomCode = String(nextRoomState?.roomCode ?? "").trim().toUpperCase()
			if (!nextRoomCode || nextRoomCode !== normalizedRoomCode) return

			queryClient.setQueryData(["room", normalizedRoomCode], nextRoomState)
		}

		const onConnect = () => {
			queryClient.invalidateQueries({ queryKey: ["room", normalizedRoomCode] })
		}

		socket.on(SOCKET_EVENTS.ROOM_UPDATE, onRoomUpdate)
		socket.on("connect", onConnect)

		return () => {
			socket.off(SOCKET_EVENTS.ROOM_UPDATE, onRoomUpdate)
			socket.off("connect", onConnect)
		}
	}, [isResultsModalOpen, queryClient, roomCode])

	React.useEffect(() => {
		if (!isResultsModalOpen) return
		if (socketGame?.status !== "finished") return
		if (!roomCode || !currentUserId) return
		if (!currentGamePlayer) return

		const participantIds = new Set(
			Array.isArray(roomStateQuery.data?.participants)
				? roomStateQuery.data.participants.map((participant) => String(participant.userId))
				: [],
		)

		if (participantIds.has(String(currentUserId))) {
			resultsRejoinAttemptRef.current = null
			return
		}

		const rejoinKey = `${roomCode}:${socketGame?.gameId ?? "finished"}:${currentUserId}`
		if (resultsRejoinAttemptRef.current === rejoinKey) return
		if (joinRoomMutation.isPending) return

		resultsRejoinAttemptRef.current = rejoinKey
		joinRoomMutation.mutate(roomCode)
	}, [
		currentGamePlayer,
		currentUserId,
		isResultsModalOpen,
		joinRoomMutation,
		roomCode,
		roomStateQuery.data?.participants,
		socketGame?.gameId,
		socketGame?.status,
	])

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
		if (!isSocketDriven || noteUrls.length === 0) {
			setNoteDurationsMs([])
			return
		}

		let isCancelled = false

		void Promise.all(noteUrls.map((url) => getGameNoteDurationMs(url)))
			.then((durations) => {
				if (isCancelled) return
				setNoteDurationsMs(durations)

				const totalDurationMs = durations.reduce((total, duration, index) => {
					const safeDuration = Math.max(0, Number(duration) || 0)
					const gapMs = index < durations.length - 1 ? FAMILIARIZE_AUTOPLAY_GAP_MS : 0
					return total + safeDuration + gapMs
				}, 0)

				if (roomCode && totalDurationMs > 0) {
					emitGameFamiliarTiming(roomCode, totalDurationMs)
				}
			})
			.catch(() => {
				if (isCancelled) return
				setNoteDurationsMs([])
			})

		return () => {
			isCancelled = true
		}
	}, [isSocketDriven, noteUrls, roomCode])

	React.useEffect(() => {
		if (!isSocketDriven) return
		const startedAt = Number(socketGame?.startedAt)
		if (!Number.isFinite(startedAt) || startedAt <= 0) return

		const autoEndsAt = startedAt + familiarAutoDurationMs
		const freeEndsAt = autoEndsAt + FREE_PLAY_MS

		const intervalId = window.setInterval(() => {
			const now = Date.now() + serverOffsetMs
			if (socketGame.status === "playing") {
				setPhase(PHASE.PLAYING)
				return
			}

			if (now < autoEndsAt) {
				setPhase(PHASE.FAMILIARIZE_AUTO)
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
	}, [familiarAutoDurationMs, isCurrentUserWaiting, isSocketDriven, padCount, serverOffsetMs, socketGame?.startedAt, socketGame?.status])

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

	React.useEffect(() => {
		if (!isSocketDriven) return
		if (socketGame?.status !== "familiarizing") return
		if (phase !== PHASE.FAMILIARIZE_AUTO) return
		if (noteUrls.length === 0) return
		if (noteDurationsMs.length !== noteUrls.length) return

		let isCancelled = false
		let currentUrl = null
		const currentGameId = socketGame?.gameId ? String(socketGame.gameId) : null

		const runAutoplay = async () => {
			for (let index = 0; index < noteUrls.length; index += 1) {
				if (isCancelled) return

				const url = noteUrls[index]
				if (shouldSkipDuplicateAutoplay(currentGameId, index)) {
					continue
				}
				currentUrl = url
				setAutoPlayIndex(index)
				setActivePadIndex(index)

				await playGameNoteAsync(url)
				if (isCancelled) return

				setActivePadIndex(null)
				currentUrl = null

				if (index < noteUrls.length - 1) {
					await waitForMs(FAMILIARIZE_AUTOPLAY_GAP_MS)
				}
			}

			if (!isCancelled) {
				setActivePadIndex(null)
			}
		}

		void runAutoplay()

		return () => {
			isCancelled = true
			if (currentUrl) {
				stopGameNote(currentUrl)
			}
		}
	}, [isSocketDriven, noteDurationsMs, noteUrls, phase, socketGame?.gameId, socketGame?.status])

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
					className="inline-flex cursor-pointer items-center justify-center gap-1 text-center text-[10px] font-bold leading-[15px] tracking-[1px] text-[#90a1b9] uppercase"
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

	React.useEffect(() => {
		// Countdown warning SFX is local-only:
		// play only for the current user's own turn in the last 10 seconds.
		if (!isMyTurn || isSpectating || socketGame?.status !== "playing") {
			lastCountdownSfxSecondRef.current = null
			return
		}

		if (
			!Number.isInteger(turnSeconds) ||
			turnSeconds <= 0 ||
			turnSeconds > COUNTDOWN_URGENT_THRESHOLD_SECONDS
		) {
			lastCountdownSfxSecondRef.current = null
			return
		}

		if (lastCountdownSfxSecondRef.current === turnSeconds) return
		lastCountdownSfxSecondRef.current = turnSeconds
		playCountdownTickSfx()
	}, [isMyTurn, isSpectating, socketGame?.status, turnSeconds])

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
