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
// Mutations that affect room state provide a default success handler that
// invalidates the matching room query so the waiting-room UI stays in sync.

// Helper: build the shared mutation config for room writes that refresh room
// state by default after a successful response.
function buildRoomStateMutationOptions({ mutationFn, queryClient, options = {} }) {
	return {
		mutationFn,
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["room", variables.roomCode] })
			options.onSuccess?.(data, variables)
		},
		...options,
	}
}

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
	return useMutation(
		buildRoomStateMutationOptions({
			mutationFn: ({ roomCode, isReady }) => setReadyStatus(roomCode, isReady),
			queryClient,
			options,
		}),
	)
}

export function useSelectModeMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation(
		buildRoomStateMutationOptions({
			mutationFn: ({ roomCode, mode }) => selectMode(roomCode, mode),
			queryClient,
			options,
		}),
	)
}

export function useSelectDifficultyMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation(
		buildRoomStateMutationOptions({
			mutationFn: ({ roomCode, difficulty }) => selectDifficulty(roomCode, difficulty),
			queryClient,
			options,
		}),
	)
}

export function useSubmitRoundResultMutation(options = {}) {
	const queryClient = useQueryClient()
	return useMutation(
		buildRoomStateMutationOptions({
			mutationFn: ({ roomCode, roundCorrectCount }) => submitRoundResult(roomCode, roundCorrectCount),
			queryClient,
			options,
		}),
	)
}
