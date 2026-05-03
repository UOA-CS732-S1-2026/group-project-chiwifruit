# Testing and Gameplay Feedback Report

This document summarises findings from manual testing, focusing on multiplayer consistency, session handling, gameplay logic, and UX improvements.

---

## 1. Functional Bugs

### Bug 1: Spectating state not stable after player is out
**Description:**
When a player (including host) is out and selects "keep spectating", the spectating mode does not behave correctly.

**Observed:**
- The "keep spectating / leave" popup repeatedly appears.
- The player cannot continue spectating normally.
- Other players still see the player as "waiting" instead of "out".

**Expected:**
- Spectating should remain stable once selected.
- Player status should update to "out" correctly for all players.

---

### Bug 2: Game state inconsistency when multiple players exit
**Description:**
In a multiplayer game, when multiple players exit, the system fails to handle the game state correctly.

**Observed:**
- Remaining player sees "waiting for other players".
- Host can start a new game but only sees "You're out!".
- Exited players cannot rejoin the game.
- System eventually resets unexpectedly.

**Expected:**
- Game should correctly handle player exits and continue or end appropriately.
- Players should not be stuck in inconsistent states.

---

### Bug 3: Duplicate player identity after rejoining
**Description:**
Players who leave and rejoin the same room may create duplicate identities.

**Observed:**
- Rejoining assigns a new identity and avatar.
- Previous identity still remains in the room.
- Duplicate players appear in the room.

**Expected:**
- Old session should be cleared when a player leaves.
- Rejoining should not create duplicate identities.

---

### Bug 4: Mobile audio inconsistency
**Description:**
Audio behaviour on mobile devices is inconsistent.

**Observed:**
- Audio does not play initially.
- Audio may start later after user interaction.

**Expected:**
- Audio should behave consistently.
- If interaction is required, user should be prompted clearly.

---

### Bug 5: Opening room link in a new tab results in missing token
**Description:**
Opening a room link in a new tab causes session issues.

**Observed:**
- "Missing bearer token" error is displayed.
- No players are visible in the room.

**Expected:**
- User should be redirected to create or restore a session.
- System should not show a raw error.

---

### Bug 6: Host refresh not reflected to other players
**Description:**
When the host refreshes during a game, other players are not updated.

**Observed:**
- Other players see the game continuing normally.
- No notification or state update is triggered.

**Expected:**
- System should detect refresh/disconnection.
- Other players should be notified or game state should update.

---

## 2. Gameplay & UX Improvements

### Improvement 1: Time limit too short in later rounds
**Observation:**
After approximately 14 rounds, the 20-second limit becomes insufficient.

**Suggestion:**
- Increase time limit gradually as rounds progress.

---

### Improvement 2: Turn indication is not clear
**Observation:**
Players may not realise when it is their turn.

**Suggestion:**
- Add animation or highlight for the active player.

---

### Improvement 3: Button visibility could be improved
**Observation:**
Buttons are not visually prominent enough.

**Suggestion:**
- Increase contrast or brightness for better visibility.

---

### Improvement 4: Default ready state after each round
**Observation:**
Players automatically return to "ready" after a round ends.

**Issue:**
- Players may unintentionally be forced into the next game.

**Suggestion:**
- Reset all players to "not ready" after each round.

---

### Improvement 5: Scoring vs ranking inconsistency
**Observation:**
Ranking is determined purely by total score.

**Issue:**
- Players who survive longer may still rank lower.
- Perceived fairness may be affected.

**Suggestion:**
- Align ranking logic with survival progression, or clearly define ranking rules.

---

## 3. Summary

The main issues identified relate to:

- Multiplayer state consistency (player status, refresh handling)
- Session and identity management (duplicate players, missing token)
- Gameplay fairness and pacing (scoring, timing)
- Mobile compatibility (audio behaviour)



---
