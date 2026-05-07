import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { reconnectSocket } from "../socket/socket"
import SOCKET_EVENTS from "../socket/socketEvents"

export function useRoomSocketUpdates(roomCode) {
	const queryClient = useQueryClient()
	const normalizedRoomCode = String(roomCode ?? "").trim().toUpperCase()

	useEffect(() => {
		if (!normalizedRoomCode) return

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
	}, [normalizedRoomCode, queryClient])
}
