import { Howl } from "howler"

import useSoundStore from "../store/useSoundStore"

const birdAudioModules = import.meta.glob("../assets/audio/birdAudio/*.mp3", {
	eager: true,
	import: "default",
})

const pianoAudioModules = import.meta.glob("../assets/audio/pianoAudio/*.mp3", {
	eager: true,
	import: "default",
})

const maoriAudioModules = import.meta.glob("../assets/audio/maoriAudio/*.mp3", {
	eager: true,
	import: "default",
})

const animalAudioModules = import.meta.glob("../assets/audio/animalAudio/*.mp3", {
	eager: true,
	import: "default",
})

const aussieAudioModules = import.meta.glob("../assets/audio/auSlang/*.mp3", {
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
	bird: normalizeEntries(birdAudioModules),
	piano: normalizeEntries(pianoAudioModules),
	maori: normalizeEntries(maoriAudioModules),
	animal: normalizeEntries(animalAudioModules),
	aussie: normalizeEntries(aussieAudioModules),
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
	const key = Object.hasOwn(AUDIO_ENTRIES, mode) ? mode : "bird"
	const entries = AUDIO_ENTRIES[key]
	if (!Array.isArray(entries) || entries.length === 0) return []

	const safePadCount = Math.max(1, Number(padCount) || 1)
	const hashedSeed = hashStringToUint32(String(seed ?? ""))
	const shuffled = seededShuffle(entries, hashedSeed)
	return shuffled.slice(0, Math.min(safePadCount, shuffled.length)).map((entry) => entry.url)
}

const howlCache = new Map()

function getOrCreateHowl(url) {
	let howl = howlCache.get(url)
	if (!howl) {
		howl = new Howl({
			src: [url],
			volume: 1,
			preload: true,
		})
		howlCache.set(url, howl)
	}
	return howl
}

function ensureHowlLoaded(howl) {
	if (!howl) return Promise.resolve()
	if (howl.state() === "loaded") return Promise.resolve()

	return new Promise((resolve) => {
		const handleLoad = () => {
			howl.off("loaderror", handleLoadError)
			resolve()
		}
		const handleLoadError = () => {
			howl.off("load", handleLoad)
			resolve()
		}

		howl.once("load", handleLoad)
		howl.once("loaderror", handleLoadError)
		howl.load()
	})
}

export async function getGameNoteDurationMs(url) {
	if (!url) return 0
	const howl = getOrCreateHowl(url)
	await ensureHowlLoaded(howl)
	const durationSeconds = Number(howl.duration())
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
	return Math.round(durationSeconds * 1000)
}

export function playGameNote(url) {
	if (!url) return
	if (useSoundStore.getState().muted) return

	const howl = getOrCreateHowl(url)

	howl.stop()
	howl.play()
}

export async function playGameNoteAsync(url, options = {}) {
	if (!url) return
	if (useSoundStore.getState().muted) return

	const howl = getOrCreateHowl(url)
	await ensureHowlLoaded(howl)

	const seekMs = Math.max(0, Number(options.seekMs) || 0)

	await new Promise((resolve) => {
		howl.stop()
		const soundId = howl.play()
		if (seekMs > 0) {
			howl.seek(seekMs / 1000, soundId)
		}

		const handleEnd = () => {
			howl.off("playerror", handlePlayError, soundId)
			resolve()
		}
		const handlePlayError = () => {
			howl.off("end", handleEnd, soundId)
			resolve()
		}

		howl.once("end", handleEnd, soundId)
		howl.once("playerror", handlePlayError, soundId)
	})
}

export function stopGameNote(url) {
	if (!url) return
	const howl = howlCache.get(url)
	if (!howl) return
	howl.stop()
}
