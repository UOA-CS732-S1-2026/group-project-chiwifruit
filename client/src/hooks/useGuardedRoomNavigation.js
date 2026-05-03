import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { getApiErrorMessage, getStoredAuthToken } from "../api/axios"
import { useGuestMutation } from "./mutations/useAuthMutations"
import { useCreateRoomMutation, useJoinRoomMutation } from "./mutations/useRoomMutations"
import { leavePreviousRoomIfNeeded, setCurrentRoomCode } from "../lib/roomLifecycle"

// Landing room navigation owns the transition between rooms.
// Before creating/joining a new room, clean up the previously tracked room so one
// browser session cannot remain in multiple room participant lists.

export default function useGuardedRoomNavigation() {
	const navigate = useNavigate()
	const [actionError, setActionError] = useState("")
	const [isCleaningRoom, setIsCleaningRoom] = useState(false)

	const guestMutation = useGuestMutation({
		onError: (error) => {
			setActionError(getApiErrorMessage(error))
		},
	})

	const createRoomMutation = useCreateRoomMutation({
		onError: (error) => {
			setActionError(getApiErrorMessage(error))
		},
	})

	const joinRoomMutation = useJoinRoomMutation({
		onError: (error) => {
			setActionError(getApiErrorMessage(error))
		},
	})

	const ensureGuestThen = (onReady) => {
		setActionError("")
		if (getStoredAuthToken()) {
			onReady()
			return
		}

		guestMutation.mutate(undefined, {
			onSuccess: () => {
				onReady()
			},
		})
	}

	const createRoomGuarded = ({ onSuccess } = {}) => {
		ensureGuestThen(() => {
			setIsCleaningRoom(true)
			leavePreviousRoomIfNeeded("")
				.finally(() => {
					setIsCleaningRoom(false)
					createRoomMutation.mutate(undefined, {
						onSuccess: (data) => {
							const roomCode = String(data?.roomCode ?? "").trim().toUpperCase()
							if (!roomCode) {
								setActionError("Create room failed. Please try again.")
								return
							}
							setCurrentRoomCode(roomCode)
							navigate(`/room/${roomCode}`, { replace: true })
							onSuccess?.(data)
						},
					})
				})
		})
	}

	const joinRoomGuarded = (roomCode, { onSuccess } = {}) => {
		const normalizedCode = String(roomCode ?? "").trim().toUpperCase()
		if (!normalizedCode) {
			setActionError("Please enter a room code.")
			return
		}

		ensureGuestThen(() => {
			setIsCleaningRoom(true)
			leavePreviousRoomIfNeeded(normalizedCode)
				.finally(() => {
					setIsCleaningRoom(false)
					joinRoomMutation.mutate(normalizedCode, {
						onSuccess: (data) => {
							const resolvedRoomCode = String(data?.roomCode ?? normalizedCode).trim().toUpperCase()
							setCurrentRoomCode(resolvedRoomCode)
							navigate(`/room/${resolvedRoomCode}`, { replace: true })
							onSuccess?.(data)
						},
					})
				})
		})
	}

	return {
		actionError,
		clearActionError: () => setActionError(""),
		isPending: isCleaningRoom || guestMutation.isPending || createRoomMutation.isPending || joinRoomMutation.isPending,
		createRoomGuarded,
		joinRoomGuarded,
	}
}
