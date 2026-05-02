import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
const TOKEN_STORAGE_KEY = "kichain:authToken"
const AUTH_USER_STORAGE_KEY = "kichain:authUser"
const AUTH_EXPIRES_AT_STORAGE_KEY = "kichain:authExpiresAt"
const AUTH_TTL_MS = 60 * 60 * 1000

// NOTE (2026-04-29): 统一前端会话持久化策略。
// - guest：存 sessionStorage（关 tab 立刻失效；刷新不失效）。
// - user：存 localStorage（同样 1 小时 TTL）。
// - 必须“原子写入 token+user+expiresAt”，否则容易出现只写了 token 导致 API 401/状态错乱。
// - 读取时会校验过期时间并做向后兼容（老版本没有 expiresAt 时会补写）。

function getSafeStorage(type) {
	if (typeof window === "undefined") return null
	try {
		if (type === "session") return window.sessionStorage
		return window.localStorage
	} catch {
		return null
	}
}

function parseStoredUser(raw) {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== "object") return null
		return parsed
	} catch {
		return null
	}
}

function clearStoredAuthSession() {
	if (typeof window === "undefined") return
	for (const storage of [getSafeStorage("local"), getSafeStorage("session")]) {
		if (!storage) continue
		try {
			storage.removeItem(TOKEN_STORAGE_KEY)
			storage.removeItem(AUTH_USER_STORAGE_KEY)
			storage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY)
		} catch {
			// no-op
		}
	}
}

function setStoredAuthExpiry(storage, ttlMs) {
	if (!storage) return
	try {
		storage.setItem(AUTH_EXPIRES_AT_STORAGE_KEY, String(Date.now() + ttlMs))
	} catch {
		// no-op
	}
}

function readAuthFromStorage(storage) {
	if (!storage) return { token: null, user: null, expiresAt: null }
	if (typeof window === "undefined") return { token: null, user: null, expiresAt: null }
	try {
		const token = storage.getItem(TOKEN_STORAGE_KEY)
		const userRaw = storage.getItem(AUTH_USER_STORAGE_KEY)
		const user = parseStoredUser(userRaw)
		const expiresAtRaw = storage.getItem(AUTH_EXPIRES_AT_STORAGE_KEY)
		const expiresAt = Number(expiresAtRaw)
		return { token, user, expiresAt }
	} catch {
		return { token: null, user: null, expiresAt: null }
	}
}

function clearStoredAuthInStorage(storage) {
	if (!storage) return
	try {
		storage.removeItem(TOKEN_STORAGE_KEY)
		storage.removeItem(AUTH_USER_STORAGE_KEY)
		storage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY)
	} catch {
		// no-op
	}
}

function ensureStoredAuthSessionIsValid() {
	const sessionStorage = getSafeStorage("session")
	const localStorage = getSafeStorage("local")

	for (const storage of [sessionStorage, localStorage]) {
		if (!storage) continue
		const { token, user, expiresAt } = readAuthFromStorage(storage)
		if (!token || !user) {
			clearStoredAuthInStorage(storage)
			continue
		}

		if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
			// Backfill expiry for older sessions without a timestamp.
			setStoredAuthExpiry(storage, AUTH_TTL_MS)
			return true
		}

		if (Date.now() >= expiresAt) {
			clearStoredAuthInStorage(storage)
			continue
		}

		return true
	}

	return false
}

function getActiveAuthStorage() {
	const sessionStorage = getSafeStorage("session")
	const localStorage = getSafeStorage("local")

	const sessionToken = sessionStorage ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null
	const sessionUser = sessionStorage ? parseStoredUser(sessionStorage.getItem(AUTH_USER_STORAGE_KEY)) : null
	if (sessionToken && sessionUser) return sessionStorage

	const localToken = localStorage ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
	const localUser = localStorage ? parseStoredUser(localStorage.getItem(AUTH_USER_STORAGE_KEY)) : null
	if (localToken && localUser) return localStorage

	return null
}

export function setStoredAuthSession(session) {
	if (typeof window === "undefined") return
	try {
		const token = typeof session?.token === "string" ? session.token : null
		const user = session?.user && typeof session.user === "object" ? session.user : null

		if (!token || !user) {
			clearStoredAuthSession()
			return
		}

		// guest vs user 的区分来自后端 JWT payload / user 对象上的 isGuest 字段。
		const isGuest = Boolean(user?.isGuest)
		const storage = isGuest ? getSafeStorage("session") : getSafeStorage("local")
		const otherStorage = isGuest ? getSafeStorage("local") : getSafeStorage("session")

		// 同一时间只允许一份有效会话，避免 local/session 同时存在导致读取顺序不确定。
		clearStoredAuthInStorage(otherStorage)
		if (!storage) return
		storage.setItem(TOKEN_STORAGE_KEY, token)
		storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
		setStoredAuthExpiry(storage, AUTH_TTL_MS)
	} catch {
		// no-op
	}
}

export function getStoredAuthToken() {
	if (typeof window === "undefined") return null
	try {
		if (!ensureStoredAuthSessionIsValid()) return null
		const storage = getActiveAuthStorage()
		if (!storage) return null
		return storage.getItem(TOKEN_STORAGE_KEY)
	} catch {
		return null
	}
}

export function setStoredAuthToken(token) {
	// Legacy API: without a user object we can't know guest vs user storage.
	// Keep behavior safe by clearing session when token is removed.
	if (typeof window === "undefined") return
	if (!token) clearStoredAuthSession()
}

export function getStoredAuthUser() {
	if (typeof window === "undefined") return null
	try {
		if (!ensureStoredAuthSessionIsValid()) return null
		const storage = getActiveAuthStorage()
		if (!storage) return null
		return parseStoredUser(storage.getItem(AUTH_USER_STORAGE_KEY))
	} catch {
		return null
	}
}

export function setStoredAuthUser(user) {
	// Legacy API: prefer setStoredAuthSession({ token, user }) for correct storage.
	if (typeof window === "undefined") return
	if (!user || typeof user !== "object") clearStoredAuthSession()
}

export function getApiErrorMessage(error) {
	if (!error) return "Unknown error"

	// Axios error format: error.response?.data?.message
	const responseMessage = error?.response?.data?.message
	if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage

	if (typeof error?.message === "string" && error.message.trim()) return error.message
	return "Request failed"
}

const api = axios.create({
	baseURL: API_URL,
	headers: {
		"Content-Type": "application/json",
	},
})

api.interceptors.request.use((config) => {
	const token = getStoredAuthToken()
	if (!token) return config
	config.headers = config.headers ?? {}
	config.headers.Authorization = `Bearer ${token}`
	return config
})

export default api
