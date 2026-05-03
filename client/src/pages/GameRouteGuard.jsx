import * as React from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import Background from "../components/Common/Background"
import { Button } from "../components/ui/button"
import { getStoredAuthUser } from "../api/axios"
import { emitGameRequestState, joinSocketRoom, reconnectSocket } from "../socket/socket"
import GamePage from "./GamePage"

const ACTIVE_GAME_STATUSES = new Set(["familiarizing", "playing"])

function getResponseMessage(response, fallback) {
	if (typeof response?.error === "string") return response.error
	if (typeof response?.message === "string") return response.message
	return fallback
}

function getGameRouteStatus(game) {
	const status = typeof game?.status === "string" ? game.status : ""
	if (ACTIVE_GAME_STATUSES.has(status)) return "active"
	if (status === "finished") return "ended"
	return "error"
}

function isSameRoomGame(game, roomCode) {
	const stateRoomCode = String(game?.roomCode ?? "").trim().toUpperCase()
	return Boolean(stateRoomCode) && stateRoomCode === String(roomCode).toUpperCase()
}

function isCurrentUserInGame(game, currentUserId) {
	if (!currentUserId) return false
	if (!Array.isArray(game?.participantsOrder)) return true
	return game.participantsOrder.map((id) => String(id)).includes(String(currentUserId))
}

function TerminalGameRouteState({ title, message, roomCode }) {
	const navigate = useNavigate()

	return (
		<Background>
			<div className="flex min-h-screen items-center justify-center px-6 text-center">
				<div>
					<p className="text-lg font-bold text-foreground">{title}</p>
					<p className="mt-2 text-sm font-semibold text-muted-foreground">{message}</p>
					<div className="mt-5 flex flex-wrap justify-center gap-3">
						{roomCode ? (
							<Button
								type="button"
								variant="outline"
								className="rounded-full px-6 py-2 text-sm font-semibold"
								onClick={() => navigate(`/room/${roomCode}`, { replace: true })}
							>
								Back to Room
							</Button>
						) : null}
						<Button
							type="button"
							className="rounded-full px-6 py-2 text-sm font-semibold"
							onClick={() => navigate("/", { replace: true })}
						>
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
	const currentUserId = getStoredAuthUser()?.id ? String(getStoredAuthUser().id) : null
	const startedGame = location.state?.startedGame
	const startedGameIdRef = React.useRef(null)
	const settledRef = React.useRef(false)
	const [routeState, setRouteState] = React.useState({ status: "loading", message: "" })

	React.useEffect(() => {
		settledRef.current = false
		setRouteState({ status: "loading", message: "" })
		startedGameIdRef.current = null
	}, [roomCode])

	React.useEffect(() => {
		if (!roomCode) return
		if (!currentUserId) return
		if (!startedGame) return
		if (!isSameRoomGame(startedGame, roomCode)) return
		if (!isCurrentUserInGame(startedGame, currentUserId)) return
		if (getGameRouteStatus(startedGame) !== "active") return

		startedGameIdRef.current = String(startedGame.gameId)
		settledRef.current = true
		setRouteState({ status: "active", message: "" })
	}, [currentUserId, roomCode, startedGame])

	React.useEffect(() => {
		if (!roomCode) {
			navigate("/", { replace: true })
			return
		}

		if (!currentUserId) {
			setRouteState({
				status: "error",
				message: "Missing session. Please return to home and join again.",
			})
			return
		}

		let isMounted = true
		const finish = (nextState) => {
			if (!isMounted || settledRef.current) return
			settledRef.current = true
			setRouteState(nextState)
		}

		const classifyGame = (game) => {
			if (!isSameRoomGame(game, roomCode)) {
				finish({ status: "error", message: "Unable to load game." })
				return
			}

			if (!isCurrentUserInGame(game, currentUserId)) {
				finish({ status: "error", message: "You are not part of this game." })
				return
			}

			const routeStatus = getGameRouteStatus(game)
			if (routeStatus === "active") {
				finish({ status: "active", message: "" })
				return
			}

			// If this route was entered immediately after a successful game_start ack,
			// ignore stale finished snapshots from the previous round. A fresh active
			// game_state for startedGameId will arrive through the same socket channel.
			if (
				routeStatus === "ended" &&
				startedGameIdRef.current &&
				String(game?.gameId ?? "") !== startedGameIdRef.current
			) {
				return
			}

			if (routeStatus === "ended") {
				finish({ status: "ended", message: "This game has already ended." })
				return
			}

			finish({ status: "error", message: "Unable to load game." })
		}

		joinSocketRoom(roomCode)
		const socket = reconnectSocket()

		const onGameState = (gameState) => {
			classifyGame(gameState)
		}
		const onGameError = (payload) => {
			finish({
				status: "error",
				message: getResponseMessage(payload, "Unable to load game."),
			})
		}
		const onConnectError = (error) => {
			finish({
				status: "error",
				message: error?.message || "Unable to connect to game.",
			})
		}

		socket.on("game_state", onGameState)
		socket.on("game_error", onGameError)
		socket.on("connect_error", onConnectError)

		emitGameRequestState(roomCode, (response) => {
			if (response?.ok && response.game) {
				classifyGame(response.game)
				return
			}

			finish({
				status: "error",
				message: getResponseMessage(response, "Unable to load game."),
			})
		})

		return () => {
			isMounted = false
			socket.off("game_state", onGameState)
			socket.off("game_error", onGameError)
			socket.off("connect_error", onConnectError)
		}
	}, [currentUserId, navigate, roomCode])

	if (routeState.status === "active") return <GamePage />

	if (routeState.status === "ended") {
		return (
			<TerminalGameRouteState
				title="Game ended"
				message={routeState.message || "This game has already ended."}
				roomCode={roomCode}
			/>
		)
	}

	if (routeState.status === "error") {
		return (
			<TerminalGameRouteState
				title="Unable to load game"
				message={routeState.message || "Unable to load game."}
				roomCode={roomCode}
			/>
		)
	}

	return (
		<Background>
			<div className="flex min-h-screen items-center justify-center px-6 text-center">
				<p className="text-sm font-semibold text-muted-foreground">Connecting to game...</p>
			</div>
		</Background>
	)
}
