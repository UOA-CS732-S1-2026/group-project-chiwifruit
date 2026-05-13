# Server Technical Notes

This document explains the backend structure, API areas, Socket.IO lifecycle, and testing approach for KiChain.

> [!IMPORTANT]
> For full project setup, root `.env` configuration, CLI startup, Docker startup, cleanup/reset steps, and deployment notes, use the root [README](../README.md). This file focuses only on backend implementation details.

## 1. Backend Responsibilities

The server is responsible for:

1. Authentication for registered users and guest users.
2. JWT creation and request authorization.
3. Room creation, joining, leaving, and cleanup.
4. Waiting-room state such as participants, host, readiness, mode, and difficulty.
5. Socket.IO room/game events for realtime multiplayer coordination.
6. Game lifecycle state, including familiarisation, active turns, elimination, forfeit handling, and results.
7. Backend validation and tests for API, room, socket, and game-service behaviours.

> [!NOTE]
> Audio files are handled as frontend static assets for the MVP. The backend no longer exposes S3/audio-resource routes for local gameplay.

## 2. Tech Stack

| Area | Technologies |
| --- | --- |
| Runtime | Node.js |
| API server | Express |
| Database | MongoDB, Mongoose |
| Realtime | Socket.IO |
| Auth | JWT |
| Testing | Jest, Supertest, MongoDB Memory Server, Socket.IO client integration tests |
| API docs | Swagger-related tooling, where maintained |

## 3. Environment Usage

The backend reads environment variables from the root `.env` file through `server/src/config/env.js`.

Important backend variables:

```bash
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/kichain-db
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=1d
```

Do not create `server/.env`. Keep environment configuration in the repository root.

> [!WARNING]
> If the backend runs inside a Docker container, `MONGODB_URI` should point to the MongoDB container name, for example `mongodb://kichain-db:27017/kichain-db`. See the root README for the full Docker explanation.

## 4. Source Structure

```text
server/src/
├── app.js                    # Express app setup and route mounting
├── server.js                 # HTTP server startup and Socket.IO initialization
├── config/                   # Environment and database configuration
├── controllers/              # HTTP route handlers
├── middleware/               # Auth and request middleware
├── models/                   # Mongoose models
├── routes/                   # Express route definitions
├── services/                 # Game, room-state, and token service logic
├── socket/                   # Socket.IO event handling
└── utils/                    # Shared backend helpers
```

## 5. API Areas

The backend API is organised around the main gameplay lifecycle.

### 5.1 Auth

Auth routes support:

1. Registering a user.
2. Logging in as a registered user.
3. Continuing as a guest user.
4. Returning a JWT token and user information for frontend session storage.

### 5.2 Rooms

Room routes support:

1. Creating a room.
2. Joining a room with a room code.
3. Reading room state.
4. Updating readiness.
5. Updating host-controlled mode and difficulty.
6. Leaving or cleaning up room participation.

### 5.3 Game and results

Game-related logic supports:

1. Starting the game from the waiting room.
2. Familiarisation-stage coordination.
3. Turn progression and pad-input validation.
4. Player elimination and forfeit behaviour.
5. Result and ranking generation.

> [!TIP]
> Keep detailed request/response examples close to route/controller tests or Swagger docs where possible. The root README should remain a setup guide, and this file should remain a backend architecture guide.

## 6. Socket.IO Lifecycle

Socket.IO is used because the multiplayer flow needs realtime updates across multiple browser sessions.

### 6.1 Waiting-room events

The waiting room needs realtime updates for:

1. Player joins.
2. Player leaves.
3. Ready-state changes.
4. Host mode/difficulty changes.
5. Room state refreshes before the game starts.

### 6.2 Game events

The game flow needs realtime updates for:

1. Starting a game.
2. Requesting the current game state.
3. Familiarisation readiness.
4. Familiarisation pad presses.
5. Active game pad presses.
6. Elimination and result updates.

### 6.3 State-model principle

The backend should treat waiting-room membership and active-game participation as related but separate concepts:

1. Waiting-room roster belongs to room state.
2. Active-game participants and result history belong to game state.
3. A player who forfeits/leaves during an active game may be removed from the room roster while still remaining in the game result snapshot.

> [!WARNING]
> Avoid using only frontend route state to infer game state. Browser refresh, back/forward navigation, or direct URL entry can create stale-route scenarios. Server-side room/game state should be the source of truth.

## 7. Testing

Backend tests are under:

```text
server/test/
```

The suite is split by scope and by the project's core realtime subsystem. Unit tests keep domain logic fast and isolated. Integration tests verify real Express, Mongoose, MongoDB, and Socket.IO behaviour where cross-layer confidence matters.

### 7.1 Test directory structure

```text
server/test/
├── jest.setup.js
├── helpers/
│   ├── auth.js
│   ├── database.js
│   └── socketServer.js
├── unit/
│   ├── auth.test.js
│   ├── room.test.js
│   ├── gameService.test.js
│   └── tokenService.test.js
├── integration/
│   └── room.integration.test.js
└── socket/
    ├── unit/
    │   ├── socket.test.js
    │   └── socketFamiliarizing.test.js
    └── integration/
        └── socket.integration.test.js
```

### 7.2 Unit tests

Locations:

```text
server/test/unit/
server/test/socket/unit/
```

Purpose:

1. Verify backend logic in isolation.
2. Keep tests fast and deterministic.
3. Mock database, JWT, Socket.IO, and service dependencies where appropriate.

Current coverage includes:

1. Auth API controller behaviour.
2. Room API controller behaviour.
3. Game service state machine, including turn progression, scoring, elimination, timeout, forfeit, and cleanup.
4. Token service payload construction.
5. Socket helper behaviour with mocked Socket.IO.
6. Socket familiarisation timer orchestration with mocked game and room services.

### 7.3 REST/API integration tests

Location:

```text
server/test/integration/
```

Purpose:

1. Verify Express routes, auth middleware, Mongoose models, and MongoDB persistence together.
2. Use `mongodb-memory-server` instead of mocking Mongoose.
3. Keep the scope focused on REST/API lifecycle behaviour rather than realtime gameplay.

Current coverage includes:

1. Room creation persistence.
2. Guest joining persistence.
3. Single-room membership enforcement.
4. Readiness persistence and readiness reset after host setting changes.
5. Room capacity overflow guard.
6. Host transfer and room deletion when participants leave.

### 7.4 Socket tests

Locations:

```text
server/test/socket/unit/
server/test/socket/integration/
```

Socket tests are kept as a separate test domain because realtime multiplayer is a core subsystem of KiChain.

Socket unit tests verify helper and timer orchestration behaviour with mocked Socket.IO, game service, and room-state service dependencies.

Socket integration tests use a real HTTP server, real Socket.IO server, real `socket.io-client`, real JWT auth, and MongoDB Memory Server. Current coverage includes:

1. Socket auth rejection for invalid tokens.
2. Game start from a real Mongo-backed room.
3. Familiarisation to playing transition when all players are ready.
4. Pad press broadcasts through Socket.IO.
5. Wrong-note elimination, finished-game broadcast, and final score persistence.
6. Active-game `leave_room` forfeit and waiting-room roster cleanup.

### 7.5 Shared test helpers

Location:

```text
server/test/helpers/
```

1. `auth.js` creates real JWT bearer tokens for integration tests.
2. `database.js` starts, clears, and stops an in-memory MongoDB instance.
3. `socketServer.js` starts a real HTTP + Socket.IO test server and provides socket event helpers such as `once`, `waitForEvent`, `waitUntil`, and `emitWithAck`.

### 7.6 Running backend tests

From the repository root, run all backend tests:

```bash
npm test --workspace=server
```

Run backend tests with coverage:

```bash
npm run test:coverage --workspace=server
```

Run only unit tests:

```bash
npm test --workspace=server -- unit
```

Run only REST/API integration tests:

```bash
npm test --workspace=server -- integration
```

Run only socket-related tests:

```bash
npm test --workspace=server -- socket
```

Run backend syntax check, tests, and health smoke test:

```bash
npm run ci --workspace=server
```

The coverage report is generated locally under:

```text
server/coverage/lcov-report/index.html
```

### 7.7 Adding new backend tests

Choose the lowest stable layer that gives enough confidence.

1. Add pure business-rule tests to `unit/`.
2. Add REST + Mongo persistence tests to `integration/`.
3. Add realtime Socket.IO behaviour tests to `socket/`.
4. Add user-facing browser flows to Playwright E2E rather than duplicating them here.

Avoid adding slow or timing-sensitive integration tests when a deterministic unit test already covers the rule. Socket integration should focus on important realtime contracts, not every internal timer branch.

## 8. Development Notes

1. Keep environment configuration at the repository root.
2. Keep backend route/controller code thin where possible, and place reusable game/room logic in services.
3. Keep socket event names centralised and consistent with the frontend socket event constants.
4. Add or update backend tests when changing room lifecycle, game lifecycle, ranking, or forfeit logic.
5. Do not reintroduce backend S3/audio routes unless the project intentionally moves audio delivery back to the backend.
