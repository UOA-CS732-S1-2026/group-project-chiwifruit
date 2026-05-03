import { leaveRoom } from "../api/rooms"
import { leaveSocketRoom } from "../socket/socket"

const CURRENT_ROOM_KEY = "kichain.currentRoomCode"

export function normalizeRoomCode(roomCode) {
	return String(roomCode ?? "").trim().toUpperCase()
}

export function getCurrentRoomCode() {
	if (typeof window === "undefined") return ""
	return normalizeRoomCode(window.localStorage.getItem(CURRENT_ROOM_KEY))
}

export function setCurrentRoomCode(roomCode) {
	if (typeof window === "undefined") return
	const normalized = normalizeRoomCode(roomCode)
	if (!normalized) {
		window.localStorage.removeItem(CURRENT_ROOM_KEY)
		return
	}
	window.localStorage.setItem(CURRENT_ROOM_KEY, normalized)
}

export function clearCurrentRoomCode(roomCode) {
	if (typeof window === "undefined") return
	const normalized = normalizeRoomCode(roomCode)
	const current = getCurrentRoomCode()
	if (!normalized || !current || current === normalized) {
		window.localStorage.removeItem(CURRENT_ROOM_KEY)
	}
}

export async function leaveTrackedRoom({ roomCode, clear = true } = {}) {
	const normalized = normalizeRoomCode(roomCode || getCurrentRoomCode())
	if (!normalized) return { skipped: true }

	try {
		return await leaveRoom(normalized)
	} catch (error) {
		return { skipped: false, error }
	} finally {
		leaveSocketRoom(normalized)
		if (clear) clearCurrentRoomCode(normalized)
	}
}

export async function leavePreviousRoomIfNeeded(nextRoomCode) {
	const next = normalizeRoomCode(nextRoomCode)
	const current = getCurrentRoomCode()
	if (!current) return
	if (next && current === next) return
	await leaveTrackedRoom({ roomCode: current, clear: true })
}

export function isCurrentRoom(roomCode) {
	const normalized = normalizeRoomCode(roomCode)
	return Boolean(normalized) && getCurrentRoomCode() === normalized
}
