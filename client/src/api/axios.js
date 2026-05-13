import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
const TOKEN_STORAGE_KEY = "kichain:authToken"
const AUTH_USER_STORAGE_KEY = "kichain:authUser"
const AUTH_EXPIRES_AT_STORAGE_KEY = "kichain:authExpiresAt"
const AUTH_TTL_MS = 60 * 60 * 1000

// NOTE (2026-04-29): Frontend auth session persistence is centralized here.
// - Guests use sessionStorage so closing the tab ends the session.
// - Registered users use localStorage so refreshes and revisits keep the session.
// - Token, user, and expiresAt must be written atomically to avoid partial auth state.
// - `expiresAt` should prefer the JWT `exp` claim and only fall back to the client TTL.
// - Reads also backfill missing expiry data for older stored sessions.

// Helper: Decode a JWT segment from base64url into a plain string.
function decodeBase64Url(value) {
	if (!value || typeof value !== "string") return null
	try {
		const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
		const padding = normalized.length % 4
		const padded = padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), "=")
		return atob(padded)
	} catch {
		return null
	}
}

// Helper: Read the JWT `exp` claim and convert it to a millisecond timestamp.
function getTokenExpiryMs(token) {
	if (typeof token !== "string") return null
	const [, payload] = token.split(".")
	if (!payload) return null

	const decodedPayload = decodeBase64Url(payload)
	if (!decodedPayload) return null

	try {
		const parsed = JSON.parse(decodedPayload)
		const expSeconds = Number(parsed?.exp)
		if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null
		return expSeconds * 1000
	} catch {
		return null
	}
}

// Helper: Prefer the server-issued token expiry and fall back to the local TTL.
function resolveStoredAuthExpiry(token) {
	return getTokenExpiryMs(token) ?? Date.now() + AUTH_TTL_MS
}

// Helper: Access browser storage defensively because tests/private mode may block it.
function getSafeStorage(type) {
	if (typeof window === "undefined") return null
	try {
		if (type === "session") return window.sessionStorage
		return window.localStorage
	} catch {
		return null
	}
}

// Helper: Parse the stored auth user payload safely.
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

// Helper: Clear auth state from every supported storage backend.
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

// Helper: Persist the session expiry separately so older storage stays compatible.
function setStoredAuthExpiry(storage, expiresAtMs) {
	if (!storage) return
	try {
		storage.setItem(AUTH_EXPIRES_AT_STORAGE_KEY, String(expiresAtMs))
	} catch {
		// no-op
	}
}

// Helper: Read a full auth snapshot from one storage backend.
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

// Helper: Remove auth data from one storage backend.
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

// Helper: Drop expired or malformed sessions and backfill expiry when possible.
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
			const nextExpiresAt = resolveStoredAuthExpiry(token)
			if (Date.now() >= nextExpiresAt) {
				clearStoredAuthInStorage(storage)
				continue
			}
			setStoredAuthExpiry(storage, nextExpiresAt)
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

// Helper: Resolve which storage currently owns the active session.
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

// Persist a complete auth session in the correct storage backend.
export function setStoredAuthSession(session) {
	if (typeof window === "undefined") return
	try {
		const token = typeof session?.token === "string" ? session.token : null
		const user = session?.user && typeof session.user === "object" ? session.user : null

		if (!token || !user) {
			clearStoredAuthSession()
			return
		}

		// Storage choice is driven by the server-authored `isGuest` flag.
		const isGuest = Boolean(user?.isGuest)
		const storage = isGuest ? getSafeStorage("session") : getSafeStorage("local")
		const otherStorage = isGuest ? getSafeStorage("local") : getSafeStorage("session")

		// Keep exactly one live session to avoid local/session precedence conflicts.
		clearStoredAuthInStorage(otherStorage)
		if (!storage) return
		storage.setItem(TOKEN_STORAGE_KEY, token)
		storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
		setStoredAuthExpiry(storage, resolveStoredAuthExpiry(token))
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
