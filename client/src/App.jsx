import { Navigate, Route, Routes } from 'react-router-dom'
import GamePage from './pages/GamePage'
import LandingPage from './pages/LandingPage'
import RoomPage from './pages/RoomPage'
import useGlobalButtonClickSound from './hooks/useGlobalButtonClickSound'

function App() {
  // Global click sound for all buttons across the app.
	useGlobalButtonClickSound()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room" element={<RoomPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
