import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import { Navigate, Route, Routes } from "react-router-dom"
import GamePage from "./pages/GamePage"
import LandingPage from "./pages/LandingPage"
import RoomPage from "./pages/RoomPage"
import useGlobalButtonClickSound from "./hooks/useGlobalButtonClickSound"

// NOTE (2026-04-29): App 级别只做“全局能力”挂载（如按钮点击音效）与路由定义。
// 具体的房间/游戏同步逻辑在各自页面内处理，避免跨页面副作用。

function App() {
  // Global click sound for all buttons across the app.
    useGlobalButtonClickSound()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/room/:roomCode" element={<RoomPage />} />
      <Route path="/game/:roomCode" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
