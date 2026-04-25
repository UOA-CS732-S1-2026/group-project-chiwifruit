# Sound Chain Sequence Backend (Express + MongoDB + S3)

This repository now contains an initialized backend project for a **sound chain sequence game**.

## Tech Stack
- **Node.js + Express.js** API server
- **MongoDB + Mongoose** for persistent data
- **AWS S3** for storing audio files (supports AWS Free Tier usage)
- **AWS SDK for JavaScript v3** for S3 client and signed URLs
- **JWT** for authentication

## Implemented APIs
1. `register()`
2. `login()`
3. `continueAsGuest()`
4. `getAudios(num)`
5. `createRoom()` (also supports joining with room ID/code param)
6. `CheckIfCandidateIsReady`
7. `SelectMode()` (`animals` or `music`)
8. `Ranking` (submit each round result + fetch current ranking)
9. **WebSocket `room_update` events** for live room state sync

---

## Project Structure

```text
src/
  app.js
  server.js
  config/
    db.js
    env.js
    s3.js
  controllers/
    authController.js
    audioController.js
    roomController.js
  middleware/
    auth.js
  models/
    User.js
    Audio.js
    Room.js
  routes/
    authRoutes.js
    audioRoutes.js
    roomRoutes.js
  services/
    audioService.js
    tokenService.js
  utils/
    roomCode.js
```

---

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required values:
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_ORIGIN` (e.g. `http://localhost:5173`)
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`

### 3) Run server

```bash
npm run dev
```

or

```bash
npm start
```

Health check:

```http
GET /health
```

---

## API Details

### Auth

#### `POST /api/auth/register`
Creates a new user account and returns JWT.

Request:
```json
{
  "username": "alice",
  "password": "secret123"
}
```

Response:
```json
{
  "message": "Register success",
  "token": "<jwt>",
  "user": {
    "id": "...",
    "username": "alice",
    "isGuest": false
  }
}
```

#### `POST /api/auth/login`
Logs in an existing user and returns JWT.

Request:
```json
{
  "username": "alice",
  "password": "secret123"
}
```

Response:
```json
{
  "message": "Login success",
  "token": "<jwt>",
  "user": {
    "id": "...",
    "username": "alice",
    "isGuest": false
  }
}
```

#### `POST /api/auth/guest`
Creates a guest session without registration and returns JWT with a random guest name.

Response:
```json
{
  "message": "Guest session created",
  "token": "<jwt>",
  "user": {
    "id": "guest_...",
    "username": "SwiftFox1234",
    "isGuest": true
  }
}
```

Use `Authorization: Bearer <jwt>` for protected routes.

---

### Audios

#### `GET /api/audios/:num?mode=animals|music`
Equivalent to `getAudios(num)`.
Returns audio metadata + short-lived S3 signed URL.

---

### Rooms

#### `POST /api/rooms`
Equivalent to `createRoom()`.
- Create room:
```json
{}
```
- Join room by code (ID param style in request body):
```json
{ "joinRoomCode": "ABC123" }
```

> Note: guest users can join existing rooms with `joinRoomCode`, but cannot create new rooms.

#### `PATCH /api/rooms/:roomCode/ready`
Set current player's readiness.

Request:
```json
{ "isReady": true }
```

#### `GET /api/rooms/:roomCode/ready`
Equivalent to `CheckIfCandidateIsReady`.
Returns participant list and `everyoneReady` boolean.
Useful as fallback polling endpoint.

#### `PATCH /api/rooms/:roomCode/mode`
Equivalent to `SelectMode()`.
Only host can set mode.

Request:
```json
{ "mode": "animals" }
```

#### `PATCH /api/rooms/:roomCode/difficulty`
Equivalent to `selectDifficulty()`.
Only host can set difficulty.

Request:
```json
{ "difficulty": "medium" }
```

#### `PATCH /api/rooms/:roomCode/ranking`
Submit current player's correct-chain count for a finished round.
The backend accumulates this value into the player's total and returns a sorted ranking.

Request:
```json
{ "roundCorrectCount": 3 }
```

#### `GET /api/rooms/:roomCode/ranking`
Get current ranking in descending order by total `correctCount`.

---

## WebSocket usage (Socket.IO)

### Why it was added
For a multiplayer lobby flow, frontend needs immediate updates when:
- a user joins the room,
- a user changes readiness,
- host selects a mode.

Polling alone works but causes delay and extra requests. Socket.IO broadcasts room changes instantly.

### Events
- Client -> server:
  - `join_room` `{ roomCode }`
  - `leave_room` `{ roomCode }`
- Server -> clients in room:
  - `room_update` with payload:
    - `roomCode`
    - `mode`
    - `participantCount`
    - `everyoneReady`
    - `participants[]`

### React client example
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

socket.emit('join_room', { roomCode: 'ABC123' });

socket.on('room_update', (state) => {
  console.log('room_update', state);
});
```

---

## Frontend integration strategy

You can choose either structure:

1. **Separate frontend/backend projects (recommended to start)**
   - frontend uses `VITE_API_BASE_URL=http://localhost:3000/api`
   - websocket server URL is `http://localhost:3000`
   - easier if teams already work on separate branches/repos.

2. **Monorepo (single project)**
   - keep `apps/frontend` and `apps/backend`
   - run both together with root scripts.

React and Express can communicate perfectly in either approach as long as:
- CORS origin matches frontend URL (`FRONTEND_ORIGIN`)
- frontend points to correct API and socket base URLs.

---

## MongoDB Collections
- `users`
- `audios`
- `rooms`

### `audios` seed expectation
Each audio record should include:
- `index` (number)
- `mode` (`animals` or `music`)
- `s3Key` (e.g. `animals/cat-01.mp3`)
- `title` (optional)

The backend signs `s3Key` into downloadable URL via S3.

---

## Notes for AWS Free Tier
- Use a single S3 bucket (e.g. `sound-chain-audios-dev`)
- Keep object size and requests low
- Use lifecycle rules to expire old temporary objects if needed
- Prefer compressed formats (e.g. mp3)
