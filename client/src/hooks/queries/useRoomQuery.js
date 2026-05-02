import { useQuery } from "@tanstack/react-query"
import { getStoredAuthToken } from "../../api/axios"
import { getRanking, getRoomState } from "../../api/rooms"

// NOTE (2026-04-29): roomState 查询必须在“有 token”时才启用。
// 原因：guest/login 流程中 token 还没落盘时会导致 /ready 401 spam。

export function useRoomQuery(roomCode, enabled = true) {
	return useQuery({
		queryKey: ["room", roomCode],
		queryFn: () => getRoomState(roomCode),
		enabled: Boolean(roomCode) && enabled && Boolean(getStoredAuthToken()),
		retry: false,
		// Stop polling when query is in error state to avoid hammering the backend.
		refetchInterval: (query) => (query.state.status === "error" ? false : 1000),
	})
}

export function useRankingQuery(roomCode, enabled = true) {
	return useQuery({
		queryKey: ["room-ranking", roomCode],
		queryFn: () => getRanking(roomCode),
		enabled: Boolean(roomCode) && enabled,
	})
}
