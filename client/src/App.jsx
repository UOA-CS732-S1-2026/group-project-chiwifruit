import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import GamePage from './pages/GamePage'
import LandingPage from './pages/LandingPage'
import RoomPage from './pages/RoomPage'
import useGlobalButtonClickSound from './hooks/useGlobalButtonClickSound'
import { getStoredAuthToken } from './api/axios'
import { leaveRoomKeepalive } from './api/rooms'

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

function App() {
  // Global click sound for all buttons across the app.
	useGlobalButtonClickSound()
  const location = useLocation()
  const navigationType = useNavigationType()
  const previousPathRef = useRef(location.pathname)
  const backLeaveInFlightRef = useRef(false)

  useEffect(() => {
    const previousPath = previousPathRef.current
    const nextPath = location.pathname
    const previousRoomCode = getRoomCodeFromPath(previousPath)

    if (
      navigationType === 'POP' &&
      previousRoomCode &&
      previousPath !== nextPath &&
      !isRoomScopedPathForRoom(nextPath, previousRoomCode) &&
      !backLeaveInFlightRef.current
    ) {
      const token = getStoredAuthToken()
      if (token) {
        backLeaveInFlightRef.current = true
        void leaveRoomKeepalive(previousRoomCode, token).finally(() => {
          backLeaveInFlightRef.current = false
        })
      }
    }

    previousPathRef.current = nextPath
  }, [location.pathname, navigationType])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:roomCode" element={<RoomPage />} />
      <Route path="/game/:roomCode" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
