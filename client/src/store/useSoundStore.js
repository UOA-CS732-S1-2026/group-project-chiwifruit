import { create } from "zustand"

const STORAGE_KEY = "kichain:soundMuted"

function readInitialMuted() {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY)
		if (value === null) return false
		return value === "true"
	} catch {
		return false
	}
}

function persistMuted(nextMuted) {
	try {
		window.localStorage.setItem(STORAGE_KEY, String(nextMuted))
	} catch {
		// no-op
	}
}

const useSoundStore = create((set, get) => ({
	muted: typeof window === "undefined" ? false : readInitialMuted(),
	setMuted: (nextMuted) => {
		persistMuted(Boolean(nextMuted))
		set({ muted: Boolean(nextMuted) })
	},
	toggleMuted: () => {
		const next = !get().muted
		persistMuted(next)
		set({ muted: next })
	},
}))

export default useSoundStore
