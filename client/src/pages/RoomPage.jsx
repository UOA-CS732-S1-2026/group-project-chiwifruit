import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import logoname from '../assets/branding/logoname.png'
import logo from '../assets/branding/logo.png'

export default function RoomPage() {
	const navigate = useNavigate()
	
	// State management
	const [isHost, setIsHost] = useState(true)
	const [currentUserReady, setCurrentUserReady] = useState(false)
	const [soundMode, setSoundMode] = useState('kiwi')
	const [players, setPlayers] = useState([
		{
			id: 1,
			username: 'Alex (You)',
			avatar: '👨‍🎨',
			isHost: true,
			isReady: false,
			status: 'Not Ready',
		},
		{
			id: 2,
			username: 'WildKiwi',
			avatar: '🦜',
			isHost: false,
			isReady: false,
			status: 'Not Ready',
		},
		{
			id: 3,
			username: 'Empty Slot',
			avatar: '👤',
			isHost: false,
			isReady: false,
			status: 'Waiting...',
			isEmpty: true,
		},
		{
			id: 4,
			username: 'Empty Slot',
			avatar: '👤',
			isHost: false,
			isReady: false,
			status: 'Waiting...',
			isEmpty: true,
		},
		{
			id: 5,
			username: 'Empty Slot',
			avatar: '👤',
			isHost: false,
			isReady: false,
			status: 'Waiting...',
			isEmpty: true,
		},
		{
			id: 6,
			username: 'Empty Slot',
			avatar: '👤',
			isHost: false,
			isReady: false,
			status: 'Waiting...',
			isEmpty: true,
		},
	])

	const roomCode = '123'
	const totalPlayers = players.length
	const readyPlayers = players.filter(p => p.isReady).length

	const handleToggleHost = () => {
		setIsHost(!isHost)
		setCurrentUserReady(false)
	}

	const handleReady = () => {
		setCurrentUserReady(!currentUserReady)
	}

	const handleStartGame = () => {
		if (isHost && readyPlayers === totalPlayers) {
			navigate('/game')
		}
	}

	const canStartGame = isHost && readyPlayers === totalPlayers

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
				<div className="flex items-center gap-3">
					<img src={logo} alt="Logo" className="h-8" />
					<img src={logoname} alt="Kchain" className="h-8" />
				</div>
				<div className="flex gap-4">
					{isHost ? (
						<button
							onClick={handleToggleHost}
							className="px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition"
						>
							👁️ View as Guest
						</button>
					) : (
						<button
							onClick={handleToggleHost}
							className="px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition"
						>
							👁️ View as Host
						</button>
					)}
					<button
						onClick={() => navigate('/')}
						className="px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition"
					>
						→ Leave Room
					</button>
				</div>
			</div>

			{/* Main Content */}
			<div className="p-8 max-w-6xl mx-auto">
				{/* Title */}
				<h1 className="text-5xl font-bold text-center text-gray-900 mb-8">
					Waiting Room
				</h1>

				{/* Room Info */}
				<div className="flex justify-center gap-6 mb-8">
					<div className="bg-white px-6 py-3 rounded-lg border border-gray-200 flex items-center gap-3">
						<span className="text-gray-600">Room Code:</span>
						<span className="text-2xl font-bold text-blue-600">{roomCode}</span>
						<button className="text-gray-400 hover:text-gray-600">📋</button>
					</div>
					<div className="bg-blue-50 px-6 py-3 rounded-lg border border-blue-300 flex items-center gap-3 font-semibold text-blue-600">
						<Users size={20} />
						{readyPlayers} / {totalPlayers} Players
					</div>
				</div>

				{/* Sound Mode Selection - Only for Host */}
				{isHost && (
					<div className="flex flex-col items-center gap-3 mb-8">
						<p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
							🎵 OWNER SETTINGS: SOUND MODE
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setSoundMode('kiwi')}
								className={`px-6 py-3 rounded-full font-semibold transition ${
									soundMode === 'kiwi'
										? 'bg-blue-600 text-white'
										: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
								}`}
							>
								🦜 Kiwi
							</button>
							<button
								onClick={() => setSoundMode('piano')}
								className={`px-6 py-3 rounded-full font-semibold transition ${
									soundMode === 'piano'
										? 'bg-blue-600 text-white'
										: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
								}`}
							>
								🎹 Piano
							</button>
						</div>
					</div>
				)}

				{/* Players Grid */}
				<div className="grid grid-cols-3 gap-6 mb-12">
					{players.map((player) => (
						<div
							key={player.id}
							className={`relative p-6 rounded-2xl flex flex-col items-center justify-center min-h-40 transition ${
								player.isEmpty
									? 'bg-gray-100 border-2 border-dashed border-gray-300'
									: player.isReady
										? 'bg-white border-2 border-green-400'
										: 'bg-white border-2 border-blue-400'
							}`}
						>
							{/* Host Crown */}
							{player.isHost && (
								<div className="absolute -top-3 -left-3 text-2xl">👑</div>
							)}

							{player.isEmpty ? (
								<div className="text-center">
									<div className="text-4xl mb-2">👤</div>
									<p className="text-sm text-gray-400">{player.status}</p>
								</div>
							) : (
								<>
									<div className="text-5xl mb-2">{player.avatar}</div>
									<h3 className="text-sm font-bold text-gray-900 text-center">
										{player.username}
									</h3>
									{player.isHost && (
										<p className="text-xs text-blue-600 font-semibold uppercase mt-1">
											Room Owner
										</p>
									)}
									<p
										className={`text-xs mt-2 font-semibold ${
											player.isReady ? 'text-green-600' : 'text-gray-500'
										}`}
									>
										{player.isReady ? '✓ Ready' : player.status}
									</p>
								</>
							)}
						</div>
					))}
				</div>

				{/* Action Button */}
				<div className="flex justify-center">
					{isHost ? (
						<button
							onClick={handleStartGame}
							disabled={!canStartGame}
							className={`px-12 py-4 rounded-full font-bold text-lg transition flex items-center justify-center gap-2 ${
								canStartGame
									? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
									: 'bg-gray-300 text-gray-500 cursor-not-allowed'
							}`}
						>
							<span>▶</span>
							<span>Start Game</span>
						</button>
					) : (
						<button
							onClick={handleReady}
							className={`px-12 py-4 rounded-full font-bold text-lg transition flex items-center justify-center ${
								currentUserReady ? 'gap-2' : ''
							} ${
								currentUserReady
									? 'bg-green-500 text-white hover:bg-green-600'
									: 'bg-white text-gray-900 border-2 border-gray-300 hover:bg-gray-50'
							}`}
						>
							{currentUserReady ? (
								<>
									<span>✓</span>
									<span>Ready!</span>
								</>
							) : (
								<span>Click to Ready</span>
							)}
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
