const GAME_PAD_PALETTE = [
	// Matches Figma button gradients + shadows/glows
	{ highlight: "#FFD230", base: "#FE9A00", shadow: "#B45309", glow: "rgba(245, 158, 11, 0.40)" },
	{ highlight: "#53EAFD", base: "#00B8DB", shadow: "#0284C7", glow: "rgba(6, 182, 212, 0.40)" },
	{ highlight: "#FFA1AD", base: "#FF2056", shadow: "#BE123C", glow: "rgba(225, 29, 72, 0.40)" },
	{ highlight: "#5EE9B5", base: "#00BC7D", shadow: "#047857", glow: "rgba(16, 185, 129, 0.40)" },
	{ highlight: "#DAB2FF", base: "#AD46FF", shadow: "#7E22CE", glow: "rgba(168, 85, 247, 0.40)" },
	{ highlight: "#FF6467", base: "#E7000B", shadow: "#B91C1C", glow: "rgba(220, 38, 38, 0.40)" },
	{ highlight: "#A3B3FF", base: "#615FFF", shadow: "#4338CA", glow: "rgba(79, 70, 229, 0.40)" },
	{ highlight: "#BBF451", base: "#7CCF00", shadow: "#4D7C0F", glow: "rgba(101, 163, 13, 0.40)" },
	{ highlight: "#FFB86A", base: "#FF6900", shadow: "#C2410C", glow: "rgba(234, 88, 12, 0.40)" },
	{ highlight: "#F4A8FF", base: "#E12AFB", shadow: "#A21CAF", glow: "rgba(192, 38, 211, 0.40)" },
]

// NOTE (2026-04-29): These are the wheel pad color themes.
// `buildPadThemeSet*` shuffles the palette and takes the first N entries.
// Randomization is currently client-side; synchronized clients would need a
// server-provided seed or explicit order.

// Helper: return a shuffled copy of the provided palette or list.
export function shuffle(items) {
	const array = [...items]
	for (let index = array.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		;[array[index], array[swapIndex]] = [array[swapIndex], array[index]]
	}
	return array
}

// Helper: map difficulty names to the number of active pads.
export function getPadCountByDifficulty(difficulty) {
	if (difficulty === "easy") return 6
	if (difficulty === "hard") return 10
	return 8
}

// Helper: build a randomized pad theme set from a named difficulty.
export function buildPadThemeSet(difficulty) {
	const padCount = getPadCountByDifficulty(difficulty)
	const order = shuffle(GAME_PAD_PALETTE)
	return order.slice(0, padCount)
}

// Helper: build a randomized pad theme set from an explicit pad count.
export function buildPadThemeSetByPadCount(padCount) {
	const safePadCount = Math.max(1, Math.min(GAME_PAD_PALETTE.length, Number(padCount) || 1))
	const order = shuffle(GAME_PAD_PALETTE)
	return order.slice(0, safePadCount)
}

export default GAME_PAD_PALETTE
