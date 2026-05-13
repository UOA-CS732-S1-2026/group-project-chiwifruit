import { create } from "zustand"

// Store: global sound preference shared across pages.
// The mute flag is persisted in localStorage so refreshes keep the user's choice.
const STORAGE_KEY = "kichain:soundMuted"

// Helper: read the initial mute state defensively from localStorage.
function readInitialMuted() {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY)
		if (value === null) return false
		return value === "true"
	} catch {
		return false
	}
}

// Helper: persist the mute preference without letting storage failures break the UI.
function persistMuted(nextMuted) {
	try {
		window.localStorage.setItem(STORAGE_KEY, String(nextMuted))
	} catch {
		// no-op
	}
}

const useSoundStore = create((set, get) => ({
	// State: `true` means mute both background music and click sound effects.
	muted: typeof window === "undefined" ? false : readInitialMuted(),
	// Handler: set the mute flag explicitly and persist it.
	setMuted: (nextMuted) => {
		persistMuted(Boolean(nextMuted))
		set({ muted: Boolean(nextMuted) })
	},
	// Handler: toggle the current mute flag.
	toggleMuted: () => {
		const next = !get().muted
		persistMuted(next)
		set({ muted: next })
	},
}))

export default useSoundStore
