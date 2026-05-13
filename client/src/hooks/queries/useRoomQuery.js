import { useQuery } from "@tanstack/react-query"
import { getStoredAuthToken } from "../../api/axios"
import { getRanking, getRoomState } from "../../api/rooms"

// NOTE (2026-04-29): The room-state query should only run once an auth token is
// available.
// This avoids `/ready` 401 noise while guest/login persistence is still settling.

export function useRoomQuery(roomCode, enabled = true) {
	return useQuery({
		queryKey: ["room", roomCode],
		queryFn: () => getRoomState(roomCode),
		enabled: Boolean(roomCode) && enabled && Boolean(getStoredAuthToken()),
		retry: false,
	})
}

export function useRankingQuery(roomCode, enabled = true) {
	return useQuery({
		queryKey: ["room-ranking", roomCode],
		queryFn: () => getRanking(roomCode),
		enabled: Boolean(roomCode) && enabled,
	})
}
