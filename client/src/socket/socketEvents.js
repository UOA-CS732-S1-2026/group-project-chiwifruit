// Socket event names shared across the client.
// Keep these in sync with server/src/socket/index.js.

// NOTE (2026-04-29): 约定：
// - JOIN_ROOM 只是订阅房间广播（room_update / game_state）。
// - LEAVE_ROOM 在本项目中被定义为“离开比赛=判负”（用于断线/退出比赛），不要滥用。

export const SOCKET_EVENTS = {
	JOIN_ROOM: "join_room",
	LEAVE_ROOM: "leave_room",
	ROOM_UPDATE: "room_update",

	GAME_START: "game_start",
	GAME_REQUEST_STATE: "game_request_state",
	GAME_STATE: "game_state",
	GAME_FAMILIAR_TIMING: "game_familiar_timing",
	GAME_FAMILIAR_AUDIO_READY: "game_familiar_audio_ready",
	GAME_FAMILIAR_AUTOPLAY_STARTED: "game_familiar_autoplay_started",
	GAME_FAMILIAR_AUTOPLAY_FINISHED: "game_familiar_autoplay_finished",
	GAME_FAMILIAR_READY: "game_familiar_ready",
	GAME_FAMILIAR_PAD_PRESS: "game_familiar_pad_press",
	GAME_PAD_SOUND: "game_pad_sound",
	GAME_PAD_PRESS: "game_pad_press",
	GAME_ERROR: "game_error",
}

export default SOCKET_EVENTS
