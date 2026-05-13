import api from "./axios"
import { getStoredAuthToken } from "./axios"

// NOTE (2026-04-29): Room membership changes should use this REST layer.
// `leaveRoom()` removes the current player from the room participant list and
// broadcasts `room_update`; it is not the same as socket `leave_room`, which
// means leaving an active match and forfeiting in this project.

export async function createRoom() {
	const { data } = await api.post("/rooms")
	return data
}

export async function joinRoom(joinRoomCode) {
	const { data } = await api.post("/rooms", { joinRoomCode })
	return data
}

export async function leaveRoom(roomCode) {
	const normalized = String(roomCode ?? "").trim().toUpperCase()
	const { data } = await api.delete(`/rooms/${normalized}`)
	return data
}

// Helper: Use `fetch(..., { keepalive: true })` so the browser can still send
// the leave request during pagehide or unload.
export function leaveRoomKeepalive(roomCode, tokenOverride) {
	const normalized = String(roomCode ?? "").trim().toUpperCase()
	if (!normalized) {
		return Promise.resolve(null)
	}

	const token = tokenOverride ?? getStoredAuthToken()
	if (!token) {
		return Promise.resolve(null)
	}

	const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
	const roomUrl = `${String(apiBaseUrl).replace(/\/$/, "")}/rooms/${normalized}`

	// Use fetch + keepalive here so the browser can still send the leave request during pagehide/unload.
	return fetch(roomUrl, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		keepalive: true,
	}).catch(() => null)
}

export async function getRoomState(roomCode) {
	const { data } = await api.get(`/rooms/${roomCode}/ready`)
	return data
}

export async function setReadyStatus(roomCode, isReady = true) {
	const { data } = await api.patch(`/rooms/${roomCode}/ready`, { isReady })
	return data
}

export async function selectMode(roomCode, mode) {
	const { data } = await api.patch(`/rooms/${roomCode}/mode`, { mode })
	return data
}

export async function selectDifficulty(roomCode, difficulty) {
	const { data } = await api.patch(`/rooms/${roomCode}/difficulty`, { difficulty })
	return data
}

export async function submitRoundResult(roomCode, roundCorrectCount) {
	const { data } = await api.patch(`/rooms/${roomCode}/ranking`, { roundCorrectCount })
	return data
}

export async function getRanking(roomCode) {
	const { data } = await api.get(`/rooms/${roomCode}/ranking`)
	return data
}
