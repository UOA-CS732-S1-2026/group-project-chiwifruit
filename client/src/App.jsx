import { Navigate, Route, Routes } from 'react-router-dom'
import FamiliarPage from './pages/FamiliarPage'
import GamePage from './pages/GamePage'
import LandingPage from './pages/LandingPage'
import ResultsPage from './pages/ResultsPage'
import RoomPage from './pages/RoomPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room" element={<RoomPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/familiar" element={<FamiliarPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
