import { Suspense, lazy, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import RoomPage from './pages/RoomPage'
import useGlobalButtonClickSound from './hooks/useGlobalButtonClickSound'
import { getStoredAuthToken } from './api/axios'
import { leaveRoomKeepalive } from './api/rooms'

const GamePage = lazy(() => import('./pages/GamePage'))

// NOTE (2026-04-29): The app shell only mounts global capabilities and route definitions.
// Room and game synchronization stay inside their own pages to avoid cross-route side effects.

// Helper: extract a normalized room code from `/room/:code` or `/game/:code` paths.
function getRoomCodeFromPath(pathname) {
  const match = /^\/(?:room|game)\/([^/]+)$/i.exec(String(pathname ?? ''));
  return match?.[1] ? String(match[1]).trim().toUpperCase() : '';
}

// Helper: check whether the next route still belongs to the same room scope.
function isRoomScopedPathForRoom(pathname, roomCode) {
  if (!roomCode) return false;
  const normalizedPath = String(pathname ?? '').toUpperCase();
  return normalizedPath === `/GAME/${roomCode}` || normalizedPath === `/ROOM/${roomCode}`;
}

// Helper: send a best-effort REST leave request when the user exits a room-scoped route.
function maybeLeaveScopedRoom(pathname, { inFlightRef } = {}) {
  const roomCode = getRoomCodeFromPath(pathname);
  if (!roomCode || inFlightRef?.current) return;

  const token = getStoredAuthToken();
  if (!token) return;

  if (inFlightRef) {
    inFlightRef.current = true;
  }

  void leaveRoomKeepalive(roomCode, token).finally(() => {
    if (inFlightRef) {
      inFlightRef.current = false;
    }
  });
}

function App() {
  // Global click sound for all buttons across the app.
	useGlobalButtonClickSound()
  const location = useLocation()
  // State refs: keep the previous route and avoid duplicate leave requests during fast navigation.
  const previousPathRef = useRef(location.pathname)
  const routeLeaveInFlightRef = useRef(false)

  useEffect(() => {
    const previousPath = previousPathRef.current
    const nextPath = location.pathname
    const previousRoomCode = getRoomCodeFromPath(previousPath)

    if (
      previousRoomCode &&
      previousPath !== nextPath &&
      !isRoomScopedPathForRoom(nextPath, previousRoomCode) &&
      !routeLeaveInFlightRef.current
    ) {
      maybeLeaveScopedRoom(previousPath, { inFlightRef: routeLeaveInFlightRef })
    }

    previousPathRef.current = nextPath
  }, [location.pathname])

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
