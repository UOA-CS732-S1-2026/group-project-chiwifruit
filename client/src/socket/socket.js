import { io } from "socket.io-client"

import { getStoredAuthToken } from "../api/axios"
import SOCKET_EVENTS from "./socketEvents"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
const SOCKET_URL = API_URL.replace(/\/?api\/?$/, "")

let socket

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

export function getSocket() {
	if (!socket) {
		socket = buildSocket()
	}
	return socket
}

export function reconnectSocket() {
	const existing = getSocket()
	// NOTE (2026-04-29): socket 连接时从 storage 重新读取 token，避免刷新/重登后仍用旧 token。
	// 前端会话 TTL 当前统一为 1 小时（见 api/axios.js）。
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
	// NOTE (2026-04-29): 该事件在后端语义是“离开比赛=判负”。
	// 如果只是离开等待房间/回首页，请走 REST DELETE /api/rooms/:roomCode。
	s.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomCode })
}

export function emitGameStart(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_START, { roomCode }, ack)
}

export function emitGameRequestState(roomCode, ack) {
	if (!roomCode) return
	const s = reconnectSocket()
	s.emit(SOCKET_EVENTS.GAME_REQUEST_STATE, { roomCode }, ack)
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

