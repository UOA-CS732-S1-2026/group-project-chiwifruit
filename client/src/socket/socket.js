import { io } from "socket.io-client"

import { getStoredAuthToken } from "../api/axios"
import SOCKET_EVENTS from "./socketEvents"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL.replace(/\/?api\/?$/, "")

let socket

// Helper: create a socket connection using the latest persisted auth token.
function buildSocket() {
	const token = getStoredAuthToken()

	return io(SOCKET_URL, {
		autoConnect: true,
		transports: ["websocket"],
		auth: {
			token: token ?? undefined,
		},
	})
}

// Helper: guard features that must only run from the waiting room route.
function isGameRoute() {
	if (typeof window === "undefined") return false
	return window.location.pathname.toLowerCase().startsWith("/game/")
}

export function getSocket() {
	if (!socket) {
		socket = buildSocket()
	}
	return socket
}

export function reconnectSocket() {
	const existing = getSocket()
	// NOTE (2026-04-29): Refresh the auth token from storage on reconnect so page
	// refreshes or re-login flows do not keep using a stale credential.
	existing.auth = {
		token: getStoredAuthToken() ?? undefined,
	}
	if (!existing.connected) {
		existing.connect()
	}
	return existing
}

export function joinSocketRoom(roomCode) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode })
}

export function leaveSocketRoom(roomCode) {
	if (!roomCode) return
	const s = getSocket()
	// NOTE (2026-04-29): This event means leaving an active match and forfeiting.
	// Use REST `DELETE /api/rooms/:roomCode` when leaving the waiting room instead.
	s.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomCode })
}

export function emitGameStart(roomCode, ack) {
	if (!roomCode) return
	// NOTE (2026-05-03): Game start must be an explicit waiting-room action.
	// GamePage also imports this helper, but it should not be allowed to start a
	// fresh game just because the browser history re-entered /game/:roomCode after
	// a previous game finished. Without this guard, browser back/forward can
	// accidentally restart the familiarisation flow from a stale game route.
	if (isGameRoute()) {
		if (typeof ack === "function") {
			ack({ ok: false, error: "Game start must be triggered from the room." })
		}
		return
	}

	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_START, { roomCode }, ack)
}

export function emitGameRequestState(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_REQUEST_STATE, { roomCode }, ack)
}

export function emitGameFamiliarTiming(roomCode, familiarAutoDurationMs, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_FAMILIAR_TIMING, { roomCode, familiarAutoDurationMs }, ack)
}

export function emitGameFamiliarAudioReady(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_FAMILIAR_AUDIO_READY, { roomCode }, ack)
}

export function emitGameFamiliarAutoplayStarted(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_FAMILIAR_AUTOPLAY_STARTED, { roomCode }, ack)
}

export function emitGameFamiliarAutoplayFinished(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_FAMILIAR_AUTOPLAY_FINISHED, { roomCode }, ack)
}

export function emitGameFamiliarReady(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_FAMILIAR_READY, { roomCode }, ack)
}

export function emitGameFamiliarPadPress(roomCode, padIndex) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_FAMILIAR_PAD_PRESS, { roomCode, padIndex })
}

export function emitGamePadPress(roomCode, padIndex) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_PAD_PRESS, { roomCode, padIndex })
}

