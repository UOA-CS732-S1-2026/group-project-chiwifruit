import { Howl } from "howler"

import useSoundStore from "../store/useSoundStore"

const kiwiAudioModules = import.meta.glob("../assets/audio/birdAudio/*.mp3", {
	import: "default",
})

const pianoAudioModules = import.meta.glob("../assets/audio/pianoAudio/*.mp3", {
	import: "default",
})

const maoriAudioModules = import.meta.glob("../assets/audio/maoriAudio/*.mp3", {
	import: "default",
})

const animalAudioModules = import.meta.glob("../assets/audio/animalAudio/*.mp3", {
	import: "default",
})

const aussieAudioModules = import.meta.glob("../assets/audio/auSlang/*.mp3", {
	import: "default",
})

function normalizeEntries(modules) {
	return Object.keys(modules)
		.sort((a, b) => String(a).localeCompare(String(b)))
		.map((path) => ({
			id: path,
			load: modules[path],
		}))
}

const AUDIO_ENTRIES = {
	kiwi: normalizeEntries(kiwiAudioModules),
	piano: normalizeEntries(pianoAudioModules),
	maori: normalizeEntries(maoriAudioModules),
	animal: normalizeEntries(animalAudioModules),
	aussie: normalizeEntries(aussieAudioModules),
}

const audioEntriesPromiseCache = new Map()

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

async function resolveAudioEntries(mode) {
	const key = Object.hasOwn(AUDIO_ENTRIES, mode) ? mode : "kiwi"
	const cachedPromise = audioEntriesPromiseCache.get(key)
	if (cachedPromise) return cachedPromise

	const loadPromise = Promise.all(
		AUDIO_ENTRIES[key].map(async (entry) => {
			const url = await entry.load()
			return typeof url === "string"
				? {
					id: entry.id,
					url,
				}
				: null
		}),
	)
		.then((entries) => entries.filter(Boolean))
		.catch((error) => {
			audioEntriesPromiseCache.delete(key)
			throw error
		})

	audioEntriesPromiseCache.set(key, loadPromise)
	return loadPromise
}

export async function pickGameNoteUrls({ mode, padCount, seed }) {
	const key = Object.hasOwn(AUDIO_ENTRIES, mode) ? mode : "kiwi"
	const entries = await resolveAudioEntries(key)
	if (!Array.isArray(entries) || entries.length === 0) return []

	const safePadCount = Math.max(1, Number(padCount) || 1)
	const hashedSeed = hashStringToUint32(String(seed ?? ""))
	const shuffled = seededShuffle(entries, hashedSeed)
	return shuffled.slice(0, Math.min(safePadCount, shuffled.length)).map((entry) => entry.url)
}

const howlCache = new Map()
const howlLoadPromiseCache = new WeakMap()

function getOrCreateHowl(url) {
	let howl = howlCache.get(url)
	if (!howl) {
		howl = new Howl({
			src: [url],
			volume: 1,
			preload: false,
		})
		howlCache.set(url, howl)
	}
	return howl
}

function ensureHowlLoaded(howl) {
	if (!howl) return Promise.resolve()
	if (howl.state() === "loaded") return Promise.resolve()

	const pendingLoad = howlLoadPromiseCache.get(howl)
	if (pendingLoad) return pendingLoad

	const loadPromise = new Promise((resolve) => {
		const handleLoad = () => {
			howl.off("loaderror", handleLoadError)
			howlLoadPromiseCache.delete(howl)
			resolve()
		}
		const handleLoadError = () => {
			howl.off("load", handleLoad)
			howlLoadPromiseCache.delete(howl)
			resolve()
		}

		howl.once("load", handleLoad)
		howl.once("loaderror", handleLoadError)
		if (howl.state() !== "loading") {
			howl.load()
		}
	})

	howlLoadPromiseCache.set(howl, loadPromise)
	return loadPromise
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
