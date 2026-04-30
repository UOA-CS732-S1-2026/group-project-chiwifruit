import { create } from "zustand"

// Global sound settings shared across pages.
// Persists the mute toggle in localStorage so refreshes keep the user preference.
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
	// `true` means: mute background music + click SFX.
	muted: typeof window === "undefined" ? false : readInitialMuted(),
	// Sets `muted` and persists to localStorage.
	setMuted: (nextMuted) => {
		persistMuted(Boolean(nextMuted))
		set({ muted: Boolean(nextMuted) })
	},
	// Convenience toggle.
	toggleMuted: () => {
		const next = !get().muted
		persistMuted(next)
		set({ muted: next })
	},
}))

export default useSoundStore
