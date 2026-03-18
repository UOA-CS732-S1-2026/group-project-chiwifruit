import { useState } from 'react'
import StartupPage from './pages/StartupPage'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  const handleStartGame = () => {
    setGameStarted(true)
    // Add your main game/app logic here
  }

  if (!gameStarted) {
    return <StartupPage onStartGame={handleStartGame} />
  }

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
      {/* Replace this with your main game/app content */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Game Started!</h1>
        <button
          onClick={() => setGameStarted(false)}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default App
