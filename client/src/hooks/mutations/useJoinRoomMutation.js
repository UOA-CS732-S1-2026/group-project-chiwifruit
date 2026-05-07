import { useCallback } from "react"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
const ROOM_FULL_STATUS = 409

export const ROOM_FULL_ERROR_MESSAGE = "This room is already full! You can create a new room instead."

export function isRoomFullError(error) {
	return error?.status === ROOM_FULL_STATUS
}

async function createGuestSession() {
	const response = await fetch(`${API_URL}/auth/guest`, { method: "POST" })

	if (!response.ok) {
		throw new Error("Unable to create guest session")
	}

	return response.json()
}

async function requestJoinRoom(roomCode, token) {
	const response = await fetch(`${API_URL}/rooms`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ joinRoomCode: roomCode }),
	})

	if (!response.ok) {
		const error = new Error("Unable to join room")
		error.status = response.status
		throw error
	}

	return response.json()
}

export default function useJoinRoomMutation() {
	const joinRoom = useCallback(async (roomCode) => {
		const guestSession = await createGuestSession()
		return requestJoinRoom(roomCode, guestSession.token)
	}, [])

	return { joinRoom }
}
