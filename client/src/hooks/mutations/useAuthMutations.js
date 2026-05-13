import { useMutation } from "@tanstack/react-query"
import { continueAsGuest, login, register } from "../../api/auth"
import { setStoredAuthSession } from "../../api/axios"

// NOTE (2026-04-29): All auth mutations persist the returned session here.
// Storage selection, TTL handling, and backward-compatible validation live in
// `api/axios.js` so callers stay thin.

// Helper: Persist the server-authored auth payload in one place.
function persistAuthSession(responseData) {
	if (!responseData || typeof responseData !== "object") return
	setStoredAuthSession({ token: responseData.token, user: responseData.user })
}

export function useRegisterMutation(options = {}) {
	return useMutation({
		mutationFn: register,
		onSuccess: (data, variables, context) => {
			persistAuthSession(data)
			options.onSuccess?.(data, variables, context)
		},
		...options,
	})
}

export function useLoginMutation(options = {}) {
	return useMutation({
		mutationFn: login,
		onSuccess: (data, variables, context) => {
			persistAuthSession(data)
			options.onSuccess?.(data, variables, context)
		},
		...options,
	})
}

export function useGuestMutation(options = {}) {
	return useMutation({
		mutationFn: continueAsGuest,
		onSuccess: (data, variables, context) => {
			persistAuthSession(data)
			options.onSuccess?.(data, variables, context)
		},
		...options,
	})
}
