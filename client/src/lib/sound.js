import { Howl } from "howler"

import clickSfxUrl from "../assets/audio/common/click.mp3"
import countdownSfxUrl from "../assets/audio/common/countdown.mp3"
import backgroundMusicUrl from "../assets/audio/common/backgroundmusic.mp3"
import losingSfxUrl from "../assets/audio/common/losing.mp3"
import winningSfxUrl from "../assets/audio/common/winning.mp3"
import useSoundStore from "../store/useSoundStore"

// NOTE (2026-04-29): 声音播放统一入口（Howler.js）。
// - clickSfx: 需要 stop()->play() 来保证连续点击时每次都从头播放
// - backgroundMusic: 处理 autoplay 被拒绝后的 unlock 重试 + 首次用户交互 retry

let clickSound
let countdownSound
let backgroundSound
let losingSound
let winningSound
let backgroundVolume = 0.22
let retryListenersAttached = false

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

function detachRetryListeners() {
	if (!retryListenersAttached) return
	document.removeEventListener("pointerdown", onRetryUserInteraction, true)
	document.removeEventListener("click", onRetryUserInteraction, true)
	window.removeEventListener("keydown", onRetryKeyDown)
	retryListenersAttached = false
}

function onRetryUserInteraction() {
	// Defer to next tick so React click handlers (mute toggle) apply first.
	window.setTimeout(() => {
		startBackgroundMusic()
		if (backgroundSound?.playing()) detachRetryListeners()
	}, 0)
}

function onRetryKeyDown() {
	startBackgroundMusic()
	if (backgroundSound?.playing()) detachRetryListeners()
}

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
