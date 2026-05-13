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

// NOTE (2026-04-29): Room write operations are centralized as React Query mutations.
// Mutations that affect room state invalidate the matching room query on success
// so the waiting-room UI stays in sync with the server.

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
