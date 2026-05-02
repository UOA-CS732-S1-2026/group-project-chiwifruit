import { useMutation } from "@tanstack/react-query"
import { continueAsGuest, login, register } from "../../api/auth"
import { setStoredAuthSession } from "../../api/axios"

// NOTE (2026-04-29): 所有 auth mutation 成功后都统一落盘 authSession。
// 落盘逻辑（guest vs user 存储、TTL、校验/回填）集中在 api/axios.js。

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
