# Client Technical Notes

This document explains the frontend structure and key implementation choices for KiChain.

> [!IMPORTANT]
> For full project setup, root `.env` configuration, CLI startup, Docker startup, cleanup/reset steps, and testing commands, use the root [README](../README.md). This file focuses only on frontend implementation details.

## 1. Frontend Responsibilities

The client is responsible for:

1. Rendering the landing page, waiting room, game page, and result flow.
2. Managing guest/user authentication state in the browser.
3. Calling backend REST APIs through the shared Axios client.
4. Connecting to Socket.IO for realtime room and game updates.
5. Playing sound effects, background music, and game audio assets.
6. Presenting reusable UI components, modals, status messages, and error states.

## 2. Tech Stack

| Area | Technologies |
| --- | --- |
| App framework | React, Vite |
| Routing | React Router |
| Server state | TanStack Query / React Query |
| HTTP client | Axios |
| Realtime | Socket.IO client |
| Styling | Tailwind CSS, Radix UI / shadcn-style components |
| Animation | Framer Motion |
| Audio | Howler.js, static frontend audio assets |

> [!NOTE]
> Audio files are served as frontend static assets for the MVP. The frontend does not rely on a backend S3/audio endpoint for local gameplay.

## 3. Workspace Commands

Run frontend commands from the repository root using the npm workspace flag.

```bash
npm run dev:client
npm run build --workspace=client
npm run ci --workspace=client
```

> [!TIP]
> Most team members should use `npm run dev` from the repository root during normal development. That starts the frontend and backend together.

## 4. Environment Usage

The client reads environment variables from the root `.env` file through Vite's `envDir` configuration.

Important frontend variables:

```bash
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_APP_NAME=KiChain
VITE_APP_ENV=development
```

Do not create `client/.env`. Keep environment configuration in the repository root.

## 5. Source Structure

```text
client/src/
├── api/                     # Axios client and API wrappers
├── assets/                  # Audio, icons, and image assets
├── components/              # Reusable UI and feature components
├── hooks/                   # Query/mutation hooks and UI/game hooks
├── lib/                     # Shared frontend helpers and audio utilities
├── pages/                   # Route-level pages
├── socket/                  # Socket.IO client and event constants
├── store/                   # Client-side state stores, where used
├── App.jsx                  # Route setup and top-level app structure
├── main.jsx                 # React entry point
└── index.css                # Global styles
```

## 6. API and Auth Flow

### 6.1 Axios client

The shared Axios client is configured in:

```text
client/src/api/axios.js
```

It uses `VITE_API_URL` as the backend REST API base URL and attaches the current JWT token to protected requests.

### 6.2 Browser session storage strategy

The frontend keeps auth state deliberately lightweight:

1. Guest users use `sessionStorage`, so the guest session naturally disappears when the tab/browser session ends.
2. Registered users use `localStorage`, so their session can persist across browser restarts.
3. Auth token, user object, and expiry timestamp are written together to avoid partial session states.
4. Expired sessions are cleared before API/socket usage.

> [!NOTE]
> This storage strategy is frontend-only session handling. Backend authorization still depends on the JWT sent with requests and socket connections.

## 7. Socket.IO Flow

Socket setup is handled in:

```text
client/src/socket/socket.js
```

The socket URL comes from `VITE_SOCKET_URL`. If it is not provided, the client falls back to deriving the socket base URL from `VITE_API_URL`.

Main frontend socket responsibilities:

1. Reconnect with the latest stored auth token.
2. Join the room socket channel from the room/game lifecycle.
3. Listen for room and game state updates.
4. Emit gameplay events such as game start, familiarisation readiness, and pad presses.

> [!WARNING]
> Do not treat browser route navigation as the source of truth for game state. The frontend should use server room/game snapshots and socket updates where possible.

## 8. Page-Level Responsibilities

### 8.1 Landing page

The landing page handles guest/login entry points, room creation, and room joining.

### 8.2 Room page

The room page handles waiting-room state, readiness, mode/difficulty display, and transition into the game flow.

### 8.3 Game page

The game page handles familiarisation, active turn state, pad input, elimination/out-of-game states, and game result display.

## 9. UI and Component Notes

The frontend favours reusable presentational components for common UI patterns, including:

1. Base modal layout.
2. Error toast / status messaging.
3. Waiting-room action bar.
4. Game status broadcast.
5. Game pad ripple feedback.
6. Player cards and result display.
7. Shared background and decorative elements.

This keeps page files focused on lifecycle/state coordination rather than low-level UI markup.

## 10. Validation

Run frontend validation from the repository root:

```bash
npm run ci --workspace=client
```

This runs linting and the frontend build check.
