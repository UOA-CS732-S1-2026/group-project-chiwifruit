import { create } from "zustand"

// Default color palette used when the local store needs a fallback pad theme order.
const DEFAULT_PAD_THEMES = [
	"bg-red-400",
	"bg-rose-400",
	"bg-orange-400",
	"bg-amber-300",
	"bg-lime-400",
	"bg-emerald-400",
	"bg-teal-400",
	"bg-cyan-400",
	"bg-sky-400",
	"bg-indigo-400",
	"bg-violet-400",
	"bg-fuchsia-400",
]

export const DIFFICULTY = {
	EASY: "easy",
	MEDIUM: "medium",
	HARD: "hard",
}

// Helper: map difficulty names to the number of pads used by the local fallback store.
const PAD_COUNT_BY_DIFFICULTY = {
	[DIFFICULTY.EASY]: 6,
	[DIFFICULTY.MEDIUM]: 8,
	[DIFFICULTY.HARD]: 10,
}

// Helper: randomize the fallback pad palette order.
function shuffle(items) {
	const array = [...items]
	for (let index = array.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		;[array[index], array[swapIndex]] = [array[swapIndex], array[index]]
	}
	return array
}

// Helper: normalize any unknown difficulty back to the supported defaults.
function coerceDifficulty(value) {
	if (value === DIFFICULTY.EASY) return value
	if (value === DIFFICULTY.HARD) return value
	return DIFFICULTY.MEDIUM
}

// Store: local game UI fallback state for difficulty and pad theme selection.
const useGameStore = create((set, get) => ({
	// State: current difficulty selection used by the local fallback game UI.
	difficulty: DIFFICULTY.MEDIUM,
	// State: persisted randomized palette order so difficulty changes reuse the same base order.
	padPaletteOrder: null,
	// State: active pad theme subset derived from the palette order and difficulty.
	padThemes: null,
	// Handler: lazily initialize pad themes only when the UI first needs them.
	ensurePadThemes: () => {
		const { padThemes, padPaletteOrder, difficulty } = get()
		if (padThemes && padPaletteOrder) return
		const nextPaletteOrder = padPaletteOrder ?? shuffle(DEFAULT_PAD_THEMES)
		const padCount = PAD_COUNT_BY_DIFFICULTY[coerceDifficulty(difficulty)]
		set({
			padPaletteOrder: nextPaletteOrder,
			padThemes: nextPaletteOrder.slice(0, padCount),
		})
	},
	// Handler: update the difficulty while preserving a stable randomized palette order.
	setDifficulty: (nextDifficulty) => {
		const normalized = coerceDifficulty(nextDifficulty)
		const nextPaletteOrder = get().padPaletteOrder ?? shuffle(DEFAULT_PAD_THEMES)
		const padCount = PAD_COUNT_BY_DIFFICULTY[normalized]
		set({
			difficulty: normalized,
			padPaletteOrder: nextPaletteOrder,
			padThemes: nextPaletteOrder.slice(0, padCount),
		})
	},
}))

export default useGameStore
