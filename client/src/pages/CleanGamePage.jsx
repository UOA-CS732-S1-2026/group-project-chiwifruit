import * as React from "react"

import { ArrowLeft, ChevronsRight } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import Background from "../components/Common/Background"
import ExitGameModal from "../components/Game/ExitGameModal"
import GameFinishedPage from "./GameFinishedPage"
import GamePlayerCard from "../components/Game/GamePlayerCard"
import GameToast from "../components/Game/GameToast"
import GameWheel from "../components/Game/GameWheel"
import YoureOutModal from "../components/Game/YoureOutModal"
import LoginButton from "../components/AuthComponent/LoginButton"
import { Button } from "../components/ui/button"
import { getStoredAuthUser } from "../api/axios"
import { useRoomQuery } from "../hooks/queries/useRoomQuery"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import useSoundStore from "../store/useSoundStore"
import {
	emitGameFamiliarReady,
	emitGamePadPress,
	emitGameRequestState,
	joinSocketRoom,
	leaveSocketRoom,
	reconnectSocket,
} from "../socket/socket"
import { pickGameNoteUrls, playGameNote } from "../lib/gameAudio"
import { buildPadThemeSetByPadCount, getPadCountByDifficulty } from "../lib/gamePadPalette"
import logo from "../assets/branding/logo.png"

const PHASE = {
	FAMILIARIZE_AUTO: "familiarize:auto",
	FAMILIARIZE_FREE: "familiarize:free",
	FAMILIARIZE_WAITING: "familiarize:waiting",
	PLAYING: "playing",
}

const FAMILIARIZE_AUTOPLAY_MS = 900
const FREE_PLAY_MS = 20_000

function coerceDifficulty(value) {
	if (value === "easy") return "easy"
	if (value === "hard") return "hard"
	return "medium"
}

function getSocketMessage(response, fallback) {
	if (typeof response?.error === "string") return response.error
	if (typeof response?.message === "string") return response.message
	return fallback
}

export default function CleanGamePage({ initialGame = null }) {
	const navigate = useNavigate()
	const { roomCode: roomCodeParam = "" } = useParams()
	const roomCode = String(roomCodeParam).trim().toUpperCase()
	const user = getStoredAuthUser()
	const currentUserId = user?.id ? String(user.id) : null
	const headerAvatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const headerLoginLabel = typeof user?.username === "string" ? user.username : "Login"

	useBackgroundMusic({ enabled: false })
	const setMuted = useSoundStore((state) => state.setMuted)
	React.useEffect(() => setMuted(false), [setMuted])

	const [socketGame, setSocketGame] = React.useState(() => initialGame ?? null)
	const [gameLoadError, setGameLoadError] = React.useState("")
	const [isGameLoading, setIsGameLoading] = React.useState(!initialGame)
	const [serverOffsetMs, setServerOffsetMs] = React.useState(0)
	const [phase, setPhase] = React.useState(PHASE.FAMILIARIZE_AUTO)
	const [activePadIndex, setActivePadIndex] = React.useState(null)
	const [autoPlayIndex, setAutoPlayIndex] = React.useState(0)
	const [freePlaySeconds, setFreePlaySeconds] = React.useState(20)
	const [turnSeconds, setTurnSeconds] = React.useState(20)
	const [toastMessage, setToastMessage] = React.useState("Familiarize yourself with the notes!")
	const [isExitModalOpen, setIsExitModalOpen] = React.useState(false)
	const [isOutModalOpen, setIsOutModalOpen] = React.useState(false)
	const [isSpectating, setIsSpectating] = React.useState(false)
	const dismissedOutModalRef = React.useRef(false)
	const hasLoadedGameRef = React.useRef(Boolean(initialGame))
	const lastAutoPlayedPadRef = React.useRef({ gameId: null, index: null, at: 0 })
	const noteUrlsRef = React.useRef([])

	const { data: roomState } = useRoomQuery(roomCode, Boolean(roomCode))
	const isSocketDriven = Boolean(socketGame?.gameId)
	const participantOrder = React.useMemo(() => (Array.isArray(socketGame?.participantsOrder) ? socketGame.participantsOrder.map(String) : []), [socketGame?.participantsOrder])
	const eliminatedIds = React.useMemo(() => (Array.isArray(socketGame?.eliminatedUserIds) ? socketGame.eliminatedUserIds.map(String) : []), [socketGame?.eliminatedUserIds])
	const waitingIds = React.useMemo(() => (Array.isArray(socketGame?.familiarReadyUserIds) ? socketGame.familiarReadyUserIds.map(String) : []), [socketGame?.familiarReadyUserIds])
	const isCurrentUserParticipant = Boolean(currentUserId) && participantOrder.includes(String(currentUserId))
	const isCurrentUserEliminated = Boolean(currentUserId) && eliminatedIds.includes(String(currentUserId))
	const isCurrentUserWaiting = Boolean(currentUserId) && waitingIds.includes(String(currentUserId))

	const difficulty = coerceDifficulty(socketGame?.difficulty || roomState?.difficulty)
	const padCount = Number(socketGame?.padCount) > 0 ? Number(socketGame.padCount) : getPadCountByDifficulty(difficulty)
	const padThemes = React.useMemo(() => buildPadThemeSetByPadCount(padCount), [padCount])
	const noteUrls = React.useMemo(() => {
		if (!isSocketDriven || !socketGame?.audioSeed) return []
		return pickGameNoteUrls({ mode: socketGame.mode || "bird", padCount, seed: socketGame.audioSeed })
	}, [isSocketDriven, padCount, socketGame?.audioSeed, socketGame?.mode])

	React.useEffect(() => {
		noteUrlsRef.current = noteUrls
	}, [noteUrls])

	React.useEffect(() => {
		if (!roomCode) {
			navigate("/", { replace: true })
			return
		}
		if (!currentUserId) {
			setGameLoadError("Please return to home and join again.")
			setIsGameLoading(false)
			return
		}

		let mounted = true
		const socket = reconnectSocket()
		joinSocketRoom(roomCode)

		const applyGameState = (nextState) => {
			if (!mounted) return
			if (typeof nextState?.serverNow === "number") setServerOffsetMs(nextState.serverNow - Date.now())
			hasLoadedGameRef.current = true
			setSocketGame(nextState)
			setGameLoadError("")
			setIsGameLoading(false)
		}
		const onGameState = (nextState) => applyGameState(nextState)
		const onGameError = (payload) => {
			const message = getSocketMessage(payload, "Game error")
			if (!mounted) return
			setToastMessage(message)
			if (!hasLoadedGameRef.current) {
				setGameLoadError(message)
				setIsGameLoading(false)
			}
		}
		const onGamePadSound = (payload) => {
			const sourceUserId = typeof payload?.userId === "string" ? payload.userId : null
			if (sourceUserId && currentUserId && sourceUserId === currentUserId) return
			const padIndex = Number(payload?.padIndex)
			const urls = noteUrlsRef.current
			if (!Number.isInteger(padIndex) || padIndex < 0 || padIndex >= urls.length) return
			playGameNote(urls[padIndex])
			setActivePadIndex(padIndex)
			window.setTimeout(() => setActivePadIndex(null), 180)
		}
		const onConnectError = (error) => {
			if (!mounted) return
			setGameLoadError(error?.message || "Unable to connect to game.")
			setIsGameLoading(false)
		}

		socket.on("game_state", onGameState)
		socket.on("game_error", onGameError)
		socket.on("game_pad_sound", onGamePadSound)
		socket.on("connect_error", onConnectError)

		emitGameRequestState(roomCode, (response) => {
			if (response?.ok && response.game) {
				applyGameState(response.game)
				return
			}
			if (!mounted) return
			setGameLoadError(getSocketMessage(response, "Unable to load game."))
			setIsGameLoading(false)
		})

		return () => {
			mounted = false
			socket.off("game_state", onGameState)
			socket.off("game_error", onGameError)
			socket.off("game_pad_sound", onGamePadSound)
			socket.off("connect_error", onConnectError)
		}
	}, [currentUserId, navigate, roomCode])

	React.useEffect(() => {
		if (!socketGame) return
		if (socketGame.status === "finished") {
			setIsExitModalOpen(false)
			setIsOutModalOpen(false)
			return
		}
		if (!isCurrentUserEliminated) {
			dismissedOutModalRef.current = false
			setIsSpectating(false)
			setIsOutModalOpen(false)
			return
		}
		setIsSpectating(true)
		if (!dismissedOutModalRef.current) setIsOutModalOpen(true)
	}, [isCurrentUserEliminated, socketGame])

	React.useEffect(() => {
		if (!socketGame || socketGame.status === "finished") return
		if (socketGame.status === "playing") {
			setPhase(PHASE.PLAYING)
			setToastMessage("Game started! Follow the sequence.")
			return
		}
		if (socketGame.status !== "familiarizing") return
		const startedAt = Number(socketGame.startedAt)
		if (!Number.isFinite(startedAt) || startedAt <= 0) return
		const autoEndsAt = startedAt + padCount * FAMILIARIZE_AUTOPLAY_MS
		const freeEndsAt = autoEndsAt + FREE_PLAY_MS
		const intervalId = window.setInterval(() => {
			const now = Date.now() + serverOffsetMs
			if (now < autoEndsAt) {
				const nextIndex = Math.min(padCount - 1, Math.max(0, Math.floor((now - startedAt) / FAMILIARIZE_AUTOPLAY_MS)))
				setPhase(PHASE.FAMILIARIZE_AUTO)
				setToastMessage("Familiarize yourself with the notes!")
				setAutoPlayIndex(nextIndex)
				setActivePadIndex(nextIndex)
				return
			}
			setActivePadIndex(null)
			setAutoPlayIndex(Math.max(0, padCount - 1))
			setFreePlaySeconds(Math.max(0, Math.ceil((freeEndsAt - now) / 1000)))
			if (isCurrentUserWaiting) {
				setPhase(PHASE.FAMILIARIZE_WAITING)
				setToastMessage("Waiting for other players to get ready...")
				return
			}
			setPhase(PHASE.FAMILIARIZE_FREE)
			setToastMessage("Familiarize yourself with the notes!")
		}, 100)
		return () => window.clearInterval(intervalId)
	}, [isCurrentUserWaiting, padCount, serverOffsetMs, socketGame])

	React.useEffect(() => {
		if (!socketGame?.turnEndsAt || socketGame.status !== "playing") return
		const intervalId = window.setInterval(() => {
			const now = Date.now() + serverOffsetMs
			setTurnSeconds(Math.max(0, Math.ceil((Number(socketGame.turnEndsAt) - now) / 1000)))
		}, 250)
		return () => window.clearInterval(intervalId)
	}, [serverOffsetMs, socketGame?.status, socketGame?.turnEndsAt])

	React.useEffect(() => {
		if (phase !== PHASE.FAMILIARIZE_AUTO) return
		if (activePadIndex == null) return
		const urls = noteUrlsRef.current
		if (activePadIndex < 0 || activePadIndex >= urls.length) return
		const now = Date.now()
		const gameId = socketGame?.gameId ? String(socketGame.gameId) : null
		const last = lastAutoPlayedPadRef.current
		if (last.gameId === gameId && last.index === activePadIndex && now - Number(last.at ?? 0) < 250) return
		lastAutoPlayedPadRef.current = { gameId, index: activePadIndex, at: now }
		playGameNote(urls[activePadIndex])
	}, [activePadIndex, phase, socketGame?.gameId])

	const players = React.useMemo(() => {
		const participants = Array.isArray(roomState?.participants) ? roomState.participants : []
		const participantById = new Map(participants.map((participant) => [String(participant.userId), participant]))
		const orderedIds = participantOrder.length > 0 ? participantOrder : participants.map((p) => String(p.userId))
		const scores = socketGame?.scores && typeof socketGame.scores === "object" ? socketGame.scores : {}
		const mapped = orderedIds.map((participantId) => {
			const participant = participantById.get(String(participantId))
			if (!participant) return null
			const isCurrentUser = Boolean(currentUserId) && String(participantId) === String(currentUserId)
			const score = Number(scores[String(participantId)])
			return {
				id: String(participantId),
				name: isCurrentUser ? `${participant.username} (You)` : participant.username,
				avatarUrl: typeof participant.avatarUrl === "string" ? participant.avatarUrl : isCurrentUser ? headerAvatarUrl : undefined,
				score: Number.isFinite(score) ? score : Number(participant.correctCount ?? 0) || 0,
				isEliminated: eliminatedIds.includes(String(participantId)),
			}
		}).filter(Boolean)
		const leftCount = Math.ceil(mapped.length / 2)
		return mapped.map((player, index) => ({ ...player, side: index < leftCount ? "left" : "right" }))
	}, [currentUserId, eliminatedIds, headerAvatarUrl, participantOrder, roomState?.participants, socketGame?.scores])

	if (socketGame?.status === "finished") return <GameFinishedPage roomCode={roomCode} game={socketGame} />

	if (!socketGame) {
		return (
			<Background>
				<div className="flex min-h-screen items-center justify-center px-6 text-center">
					{gameLoadError && !isGameLoading ? (
						<div>
							<p className="text-sm font-semibold text-destructive">{gameLoadError}</p>
							<Button type="button" variant="outline" className="mt-4 rounded-full px-6 py-2 text-sm font-semibold" onClick={() => navigate(roomCode ? `/room/${roomCode}` : "/", { replace: true })}>Return</Button>
						</div>
					) : <p className="text-sm font-semibold text-muted-foreground">Connecting to game...</p>}
				</div>
			</Background>
		)
	}

	const currentTurnUserId = socketGame.currentTurnUserId ? String(socketGame.currentTurnUserId) : null
	const inputCount = Number(socketGame.inputIndex ?? 0) || 0
	const sequence = Array.isArray(socketGame.sequence) ? socketGame.sequence : []
	const requiredInputCount = Math.max(1, sequence.length + 1)
	const isFamiliarize = phase !== PHASE.PLAYING
	const padsDisabled = phase === PHASE.FAMILIARIZE_AUTO || phase === PHASE.FAMILIARIZE_WAITING || (phase === PHASE.FAMILIARIZE_FREE && isCurrentUserWaiting) || (phase === PHASE.PLAYING && (isSpectating || !currentUserId || (currentTurnUserId && currentTurnUserId !== currentUserId)))

	const centerContent = isFamiliarize ? (
		<div className="flex flex-col items-center gap-3">
			<div className="h-[66px] min-w-[177px] rounded-full border border-[#96f7e4] bg-white shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]">
				<div className="flex size-full flex-col items-center justify-center px-[25px] py-[9px] text-center">
					<p className="text-[18px] font-bold leading-7 tracking-[0.9px] text-[#00bba7] uppercase">FAMILIARIZE!</p>
					<p className="-mt-0.5 font-bold text-[#62748e]">
						{phase === PHASE.FAMILIARIZE_AUTO ? <span className="text-[14px] leading-5">Playing sounds {Math.min(autoPlayIndex + 1, padCount)} / {padCount}</span> : phase === PHASE.FAMILIARIZE_WAITING ? <span className="text-[14px] leading-5 text-[#00bba7]">Waiting for other players...</span> : <span className="text-[14px] leading-5">Free play ends in <span className="text-[#00bba7]">{freePlaySeconds}s</span></span>}
					</p>
				</div>
			</div>
			{phase === PHASE.FAMILIARIZE_FREE && isCurrentUserParticipant ? <button type="button" onClick={() => emitGameFamiliarReady(roomCode)} className="inline-flex items-center justify-center gap-1 text-center text-[10px] font-bold leading-[15px] tracking-[1px] text-[#90a1b9] uppercase"><span>Click to Skip</span><ChevronsRight className="size-3" /></button> : null}
		</div>
	) : (
		<div className="rounded-full bg-white px-6 py-4 text-center shadow-sm">
			<p className="text-sm font-bold text-[#1d293d]">{currentTurnUserId === currentUserId ? "Your turn" : "Watch the sequence"}</p>
			<p className="text-xs font-semibold text-[#62748e]">{inputCount >= sequence.length ? "Add a note" : `${inputCount} / ${sequence.length}`}</p>
		</div>
	)

	const handlePadPress = (index) => {
		if (padsDisabled) return
		const urls = noteUrlsRef.current
		if (index < 0 || index >= urls.length) return
		setActivePadIndex(index)
		window.setTimeout(() => setActivePadIndex(null), 180)
		playGameNote(urls[index])
		if (socketGame.status === "playing") emitGamePadPress(roomCode, index)
	}

	const leftPlayers = players.filter((player) => player.side === "left")
	const rightPlayers = players.filter((player) => player.side === "right")

	return (
		<Background>
			<ExitGameModal open={isExitModalOpen} onCancel={() => setIsExitModalOpen(false)} onConfirm={() => { setIsExitModalOpen(false); if (roomCode) leaveSocketRoom(roomCode); navigate(roomCode ? `/room/${roomCode}` : "/", { replace: true }) }} />
			<YoureOutModal open={isOutModalOpen} onKeepSpectating={() => { dismissedOutModalRef.current = true; setIsOutModalOpen(false) }} onBackToWaitingRoom={() => { dismissedOutModalRef.current = true; setIsOutModalOpen(false); navigate(roomCode ? `/room/${roomCode}` : "/", { replace: true }) }} />
			<div className="mx-auto w-full max-w-[90rem] px-4 pb-14 pt-6 md:px-6 lg:px-8">
				<header className="mb-6 flex items-center justify-between">
					<button type="button" onClick={() => setIsExitModalOpen(true)} className="inline-flex size-11 items-center justify-center rounded-full bg-white text-[#45556c] shadow-sm hover:bg-[#f1f5f9]" aria-label="Exit game"><ArrowLeft className="size-5" /></button>
					<img src={logo} alt="Kichain" className="h-10 w-auto" />
					<LoginButton avatarUrl={headerAvatarUrl} label={headerLoginLabel} />
				</header>
				<div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[260px_1fr_260px]">
					<div className="space-y-3">{leftPlayers.map((player) => <GamePlayerCard key={player.id} name={player.name} avatarUrl={player.avatarUrl} score={player.score} status={player.isEliminated ? "OUT" : "WAITING"} isCurrentTurn={player.id === currentTurnUserId} turnSeconds={player.id === currentTurnUserId ? turnSeconds : undefined} />)}</div>
					<div><GameWheel pads={padThemes} activePadIndex={activePadIndex} disabled={padsDisabled} onPadPress={handlePadPress} centerContent={centerContent} /><div className="mt-6 flex justify-center"><GameToast message={toastMessage} /></div></div>
					<div className="space-y-3">{rightPlayers.map((player) => <GamePlayerCard key={player.id} name={player.name} avatarUrl={player.avatarUrl} score={player.score} status={player.isEliminated ? "OUT" : "WAITING"} isCurrentTurn={player.id === currentTurnUserId} turnSeconds={player.id === currentTurnUserId ? turnSeconds : undefined} />)}</div>
				</div>
				{phase === PHASE.PLAYING ? <p className="mt-6 text-center text-sm font-semibold text-muted-foreground">{isSpectating ? "You are out. Keep watching the remaining players." : `Progress: ${Math.min(inputCount, requiredInputCount)} / ${requiredInputCount}`}</p> : null}
			</div>
		</Background>
	)
}
