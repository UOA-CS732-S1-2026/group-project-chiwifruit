import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { getApiErrorMessage, getStoredAuthToken } from "../api/axios"
import { useGuestMutation } from "./mutations/useAuthMutations"
import { useCreateRoomMutation, useJoinRoomMutation } from "./mutations/useRoomMutations"

// NOTE (2026-04-29): 统一封装 Landing 的“先确保 guest token，再 create/join room”流程。
// 这样 LandingPage 不需要关心 auth 细节，避免忘了先拿 token 导致 401。

export default function useGuardedRoomNavigation() {
	const navigate = useNavigate()
	const [actionError, setActionError] = useState("")

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

	// Guard flow shared by create/join: ensure guest session before room API call.
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
			createRoomMutation.mutate(undefined, {
				onSuccess: (data) => {
					// Navigate only after backend confirms room creation.
					const roomCode = String(data?.roomCode ?? "").trim().toUpperCase()
					if (!roomCode) {
						setActionError("Create room failed. Please try again.")
						return
					}
					navigate(`/room/${roomCode}`)
					onSuccess?.(data)
				},
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
			joinRoomMutation.mutate(normalizedCode, {
				onSuccess: (data) => {
					// Same protection for join: no route change until server accepts code.
					const resolvedRoomCode = String(data?.roomCode ?? normalizedCode).trim().toUpperCase()
					navigate(`/room/${resolvedRoomCode}`)
					onSuccess?.(data)
				},
			})
		})
	}

	return {
		actionError,
		clearActionError: () => setActionError(""),
		isPending: guestMutation.isPending || createRoomMutation.isPending || joinRoomMutation.isPending,
		createRoomGuarded,
		joinRoomGuarded,
	}
}
