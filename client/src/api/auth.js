import api from "./axios"

// NOTE (2026-04-29): Auth endpoints return { token, user }.
// Callers should persist the session via `setStoredAuthSession()` so storage
// selection (guest/sessionStorage, user/localStorage) and expiry stay aligned.

export async function register({ username, password }) {
	const { data } = await api.post("/auth/register", { username, password })
	return data
}

export async function login({ username, password }) {
	const { data } = await api.post("/auth/login", { username, password })
	return data
}

export async function continueAsGuest() {
	const { data } = await api.post("/auth/guest")
	return data
}
