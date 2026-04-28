import api from "./axios"

// NOTE (2026-04-29): auth API 返回 { token, user }，并由上层统一调用 setStoredAuthSession()
// 写入 storage（guest/sessionStorage, user/localStorage）以及 expiresAt。

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
