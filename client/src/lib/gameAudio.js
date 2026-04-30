import { Howl } from "howler"

import useSoundStore from "../store/useSoundStore"

const kiwiAudioModules = import.meta.glob("../assets/audio/kiwiAudio/*.mp3", {
	eager: true,
	import: "default",
})

const pianoAudioModules = import.meta.glob("../assets/audio/pianoAudio/*.mp3", {
	eager: true,
	import: "default",
})

function normalizeEntries(modules) {
	return Object.keys(modules)
		.sort((a, b) => String(a).localeCompare(String(b)))
		.map((path) => ({
			id: path,
			url: modules[path],
		}))
		.filter((entry) => typeof entry.url === "string")
}

const AUDIO_ENTRIES = {
	bird: normalizeEntries(kiwiAudioModules),
	piano: normalizeEntries(pianoAudioModules),
}

function hashStringToUint32(value) {
	let hash = 2166136261
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

function mulberry32(seed) {
	let t = seed >>> 0
	return function next() {
		t += 0x6d2b79f5
		let x = t
		x = Math.imul(x ^ (x >>> 15), x | 1)
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296
	}
}

function seededShuffle(items, seed) {
	const random = mulberry32(seed)
	const array = [...items]
	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
	return array
}

export function pickGameNoteUrls({ mode, padCount, seed }) {
	const key = mode === "piano" ? "piano" : "bird"
	const entries = AUDIO_ENTRIES[key]
	if (!Array.isArray(entries) || entries.length === 0) return []

	const safePadCount = Math.max(1, Number(padCount) || 1)
	const hashedSeed = hashStringToUint32(String(seed ?? ""))
	const shuffled = seededShuffle(entries, hashedSeed)
	return shuffled.slice(0, Math.min(safePadCount, shuffled.length)).map((entry) => entry.url)
}

const howlCache = new Map()

export function playGameNote(url) {
	if (!url) return
	if (useSoundStore.getState().muted) return

	let howl = howlCache.get(url)
	if (!howl) {
		howl = new Howl({
			src: [url],
			volume: 1,
			preload: true,
		})
		howlCache.set(url, howl)
	}

	howl.stop()
	howl.play()
}
