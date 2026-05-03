import * as React from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import Background from "../components/Common/Background"
import { Button } from "../components/ui/button"
import { getStoredAuthUser } from "../api/axios"
import { emitGameRequestState, joinSocketRoom, reconnectSocket } from "../socket/socket"
import GameFinishedPage from "./GameFinishedPage"
import GamePage from "./GamePage"

const ACTIVE_STATUSES = new Set(["familiarizing", "playing"])

function responseMessage(response, fallback) {
	if (typeof response?.error === "string") return response.error
	if (typeof response?.message === "string") return response.message
	return fallback
}

function isSameRoom(game, roomCode) {
	return String(game?.roomCode ?? "").trim().toUpperCase() === String(roomCode).trim().toUpperCase()
}

function includesPlayer(game, playerId) {
	if (!playerId) return false
	if (!Array.isArray(game?.participantsOrder)) return true
	return game.participantsOrder.map(String).includes(String(playerId))
}

function classifyGame(game, roomCode, playerId) {
	if (!game || !isSameRoom(game, roomCode)) {
		return { status: "error", message: "Unable to load game.", game: null }
	}
	if (!includesPlayer(game, playerId)) {
		return { status: "error", message: "You are not part of this game.", game: null }
	}
	if (ACTIVE_STATUSES.has(String(game.status))) {
		return { status: "active", message: "", game }
	}
	if (game.status === "finished") {
		return { status: "finished", message: "", game }
	}
	return { status: "error", message: "Unable to load game.", game: null }
}

function RouteError({ title, message, roomCode }) {
	const navigate = useNavigate()
	return (
		<Background>
			<div className="flex min-h-screen items-center justify-center px-6 text-center">
				<div>
					<p className="text-lg font-bold text-foreground">{title}</p>
					<p className="mt-2 text-sm font-semibold text-muted-foreground">{message}</p>
					<div className="mt-5 flex flex-wrap justify-center gap-3">
						{roomCode ? (
							<Button type="button" variant="outline" className="rounded-full px-6 py-2 text-sm font-semibold" onClick={() => navigate(`/room/${roomCode}`, { replace: true })}>
								Back to Room
							</Button>
						) : null}
						<Button type="button" className="rounded-full px-6 py-2 text-sm font-semibold" onClick={() => navigate("/", { replace: true })}>
							Back to Home
						</Button>
					</div>
				</div>
			</div>
		</Background>
	)
}

export default function GameRouteGuard() {
	const navigate = useNavigate()
	const location = useLocation()
	const { roomCode: roomCodeParam = "" } = useParams()
	const roomCode = String(roomCodeParam).trim().toUpperCase()
	const playerId = getStoredAuthUser()?.id ? String(getStoredAuthUser().id) : null
	const startedGame = location.state?.startedGame
	const [routeState, setRouteState] = React.useState({ status: "loading", message: "", game: null })

	React.useEffect(() => {
		setRouteState({ status: "loading", message: "", game: null })
	}, [roomCode])

	React.useEffect(() => {
		if (!roomCode) {
			navigate("/", { replace: true })
			return
		}
		if (!playerId) {
			setRouteState({ status: "error", message: "Please return to home and join again.", game: null })
			return
		}

		if (startedGame) {
			const initialState = classifyGame(startedGame, roomCode, playerId)
			if (initialState.status === "active") {
				setRouteState(initialState)
				return
			}
		}

		let mounted = true
		const socket = reconnectSocket()
		joinSocketRoom(roomCode)
		const setIfMounted = (next) => {
			if (mounted) setRouteState(next)
		}
		const onGameState = (gameState) => setIfMounted(classifyGame(gameState, roomCode, playerId))
		const onGameError = (payload) => setIfMounted({ status: "error", message: responseMessage(payload, "Unable to load game."), game: null })
		const onConnectError = (error) => setIfMounted({ status: "error", message: error?.message || "Unable to connect to game.", game: null })

		socket.on("game_state", onGameState)
		socket.on("game_error", onGameError)
		socket.on("connect_error", onConnectError)
		emitGameRequestState(roomCode, (response) => {
			if (response?.ok && response.game) {
				onGameState(response.game)
				return
			}
			onGameError(response)
		})

		return () => {
			mounted = false
			socket.off("game_state", onGameState)
			socket.off("game_error", onGameError)
			socket.off("connect_error", onConnectError)
		}
	}, [navigate, playerId, roomCode, startedGame])

	if (routeState.status === "active") return <GamePage initialGame={routeState.game} />
	if (routeState.status === "finished") return <GameFinishedPage roomCode={roomCode} game={routeState.game} />
	if (routeState.status === "error") return <RouteError title="Unable to load game" message={routeState.message} roomCode={roomCode} />

	return (
		<Background>
			<div className="flex min-h-screen items-center justify-center px-6 text-center">
				<p className="text-sm font-semibold text-muted-foreground">Connecting to game...</p>
			</div>
		</Background>
	)
}
