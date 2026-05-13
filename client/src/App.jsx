import { Suspense, lazy, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import RoomPage from './pages/RoomPage'
import useGlobalButtonClickSound from './hooks/useGlobalButtonClickSound'
import { getStoredAuthToken } from './api/axios'
import { leaveRoomKeepalive } from './api/rooms'

const GamePage = lazy(() => import('./pages/GamePage'))

// NOTE (2026-04-29): App 级别只做“全局能力”挂载（如按钮点击音效）与路由定义。
// 具体的房间/游戏同步逻辑在各自页面内处理，避免跨页面副作用。

function getRoomCodeFromPath(pathname) {
  const match = /^\/(?:room|game)\/([^/]+)$/i.exec(String(pathname ?? ''));
  return match?.[1] ? String(match[1]).trim().toUpperCase() : '';
}

function isRoomScopedPathForRoom(pathname, roomCode) {
  if (!roomCode) return false;
  const normalizedPath = String(pathname ?? '').toUpperCase();
  return normalizedPath === `/GAME/${roomCode}` || normalizedPath === `/ROOM/${roomCode}`;
}

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
