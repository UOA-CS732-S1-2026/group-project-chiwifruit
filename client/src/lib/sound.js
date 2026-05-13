import { Howl } from "howler"

import clickSfxUrl from "../assets/audio/common/click.mp3"
import countdownSfxUrl from "../assets/audio/common/countdown.mp3"
import backgroundMusicUrl from "../assets/audio/common/backgroundmusic.mp3"
import losingSfxUrl from "../assets/audio/common/losing.mp3"
import winningSfxUrl from "../assets/audio/common/winning.mp3"
import useSoundStore from "../store/useSoundStore"

// NOTE (2026-04-29): Centralized sound playback entrypoint powered by Howler.
// - `clickSfx` uses stop() -> play() so rapid clicks always restart from frame 0.
// - `backgroundMusic` retries after autoplay rejection and the next user interaction.

// Module state: lazily created Howler instances and shared background playback flags.
let clickSound
let countdownSound
let backgroundSound
let losingSound
let winningSound
let backgroundVolume = 0.22
let retryListenersAttached = false

// Helper: lazily create the shared button click sound instance.
function getClickSound() {
	if (!clickSound) {
		clickSound = new Howl({
			src: [clickSfxUrl],
			volume: 0.7,
			preload: true,
		})
	}
	return clickSound
}

// Helper: lazily create the looping background music instance.
function getBackgroundSound() {
	if (!backgroundSound) {
		backgroundSound = new Howl({
			src: [backgroundMusicUrl],
			loop: true,
			volume: backgroundVolume,
			preload: true,
		})

		// Browser may reject autoplay until first user interaction.
		backgroundSound.on("playerror", () => {
			backgroundSound.once("unlock", () => {
				startBackgroundMusic()
			})
		})
	}
	return backgroundSound
}

// Helper: lazily create the countdown warning sound instance.
function getCountdownSound() {
	if (!countdownSound) {
		countdownSound = new Howl({
			src: [countdownSfxUrl],
			volume: 0.75,
			preload: true,
		})
	}
	return countdownSound
}

// Helper: lazily create the losing result sound instance.
function getLosingSound() {
	if (!losingSound) {
		losingSound = new Howl({
			src: [losingSfxUrl],
			volume: 0.8,
			preload: true,
		})
	}
	return losingSound
}

// Helper: lazily create the winning result sound instance.
function getWinningSound() {
	if (!winningSound) {
		winningSound = new Howl({
			src: [winningSfxUrl],
			volume: 0.8,
			preload: true,
		})
	}
	return winningSound
}

// Helper: tear down one-shot autoplay retry listeners when they are no longer needed.
function detachRetryListeners() {
	if (!retryListenersAttached) return
	document.removeEventListener("pointerdown", onRetryUserInteraction, true)
	document.removeEventListener("click", onRetryUserInteraction, true)
	window.removeEventListener("keydown", onRetryKeyDown)
	retryListenersAttached = false
}

// Helper: retry autoplay after pointer interaction once React click handlers have run.
function onRetryUserInteraction() {
	// Defer to next tick so React click handlers (mute toggle) apply first.
	window.setTimeout(() => {
		startBackgroundMusic()
		if (backgroundSound?.playing()) detachRetryListeners()
	}, 0)
}

// Helper: retry autoplay on keyboard interaction for accessibility parity.
function onRetryKeyDown() {
	startBackgroundMusic()
	if (backgroundSound?.playing()) detachRetryListeners()
}

// Helper: register the one-shot autoplay retry listeners.
function attachRetryListeners() {
	if (retryListenersAttached) return
	document.addEventListener("pointerdown", onRetryUserInteraction, true)
	document.addEventListener("click", onRetryUserInteraction, true)
	window.addEventListener("keydown", onRetryKeyDown)
	retryListenersAttached = true
}

export function playClickSfx() {
	if (useSoundStore.getState().muted) return
	const sound = getClickSound()
	// Restart from the beginning for consistent feedback on rapid clicks.
	sound.stop()
	sound.play()
}

export function playCountdownTickSfx() {
	if (useSoundStore.getState().muted) return
	try {
		const sound = getCountdownSound()
		if (sound.playing()) sound.stop()
		sound.play()
	} catch {
		// Countdown SFX must never break gameplay rendering.
	}
}

export function playLosingSfx() {
	if (useSoundStore.getState().muted) return
	const sound = getLosingSound()
	sound.stop()
	sound.play()
}

export function playWinningSfx() {
	if (useSoundStore.getState().muted) return
	const sound = getWinningSound()
	sound.stop()
	sound.play()
}

export function setBackgroundMusicVolume(volume) {
	backgroundVolume = volume
	if (!backgroundSound) return
	backgroundSound.volume(volume)
}

export function startBackgroundMusic() {
	if (useSoundStore.getState().muted) return
	const sound = getBackgroundSound()
	sound.volume(backgroundVolume)
	if (sound.playing()) return
	sound.play()
}

export function pauseBackgroundMusic() {
	if (!backgroundSound) return
	backgroundSound.pause()
}

export function syncBackgroundMusicWithMute() {
	if (useSoundStore.getState().muted) {
		pauseBackgroundMusic()
		return
	}
	startBackgroundMusic()
}

export function enableBackgroundMusicAutoplayRetry() {
	attachRetryListeners()
}

export function disableBackgroundMusicAutoplayRetry() {
	detachRetryListeners()
}
