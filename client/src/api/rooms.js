import api from "./axios"
import { getStoredAuthToken } from "./axios"

// NOTE (2026-04-29): Room REST API.
// leaveRoom() means removing the current user from the room participants list and broadcasting room_update.
// This is not the same as socket leave_room, which means leaving the active match and forfeiting.

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
