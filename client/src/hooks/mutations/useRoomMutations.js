import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
	createRoom,
	joinRoom,
	leaveRoom,
	setReadyStatus,
	selectMode,
	selectDifficulty,
	submitRoundResult,
} from "../../api/rooms"

// NOTE (2026-04-29): 把 room 的写操作统一封装成 React Query mutations。
// 对会影响 roomState 的操作，在 onSuccess 里 invalidate 对应 room query，保证 UI 及时同步。

export function useCreateRoomMutation(options = {}) {
	return useMutation({
		mutationFn: createRoom,
		...options,
	})
}

export function useJoinRoomMutation(options = {}) {
	return useMutation({
		mutationFn: (joinRoomCode) => joinRoom(joinRoomCode),
		...options,
	})
}

export function useLeaveRoomMutation(options = {}) {
	return useMutation({
		mutationFn: (roomCode) => leaveRoom(roomCode),
		...options,
	})
}

export function useSetReadyMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ roomCode, isReady }) => setReadyStatus(roomCode, isReady),
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["room", variables.roomCode] })
			options.onSuccess?.(data, variables)
		},
		...options,
	})
}

export function useSelectModeMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ roomCode, mode }) => selectMode(roomCode, mode),
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["room", variables.roomCode] })
			options.onSuccess?.(data, variables)
		},
		...options,
	})
}

export function useSelectDifficultyMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ roomCode, difficulty }) => selectDifficulty(roomCode, difficulty),
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["room", variables.roomCode] })
			options.onSuccess?.(data, variables)
		},
		...options,
	})
}

export function useSubmitRoundResultMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ roomCode, roundCorrectCount }) => submitRoundResult(roomCode, roundCorrectCount),
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["room", variables.roomCode] })
			options.onSuccess?.(data, variables)
		},
		...options,
	})
}
