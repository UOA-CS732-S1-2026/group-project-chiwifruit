import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Common/Background'
import BrandLockup from '../components/Common/BrandLockup'
import kiwi from '../assets/kiwi.svg'
import music from '../assets/music.svg'
import human from '../assets/human.svg'
import fire from '../assets/fire.svg'
import circle from '../assets/circle.svg'
import normal from '../assets/normal.svg'
import people from '../assets/people.svg'
import golden from '../assets/golden.svg'

export default function RoomPage() {
	const navigate = useNavigate()
	
	// State management
	const [isHost, setIsHost] = useState(true)
	const [currentUserReady, setCurrentUserReady] = useState(false)
	const [soundMode, setSoundMode] = useState('kiwi')
	const [difficulty, setDifficulty] = useState('easy')

	const roomCode = '1234'
	const basePlayers = [
		{
			id: 1,
			username: isHost ? 'Alex (You)' : 'Alex',
			avatar: '👨‍🎨',
			isHost: true,
			isReady: false,
			status: 'Room Owner',
		},
		{
			id: 2,
			username: isHost ? 'Jordan' : 'Jordan (You)',
			avatar: '🧍‍♀️',
			isHost: false,
			isReady: !isHost && currentUserReady,
			status: !isHost && currentUserReady ? 'Ready' : 'Not Ready',
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
	]

	const totalPlayers = basePlayers.length
	const readyPlayers = basePlayers.filter(p => p.isReady).length

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
		<Background>
			<div className="min-h-screen">
				{/* Header */}
				<header className="flex items-center justify-between px-8 py-5">
					<BrandLockup />
					<div className="flex items-center gap-3">
						<button
							onClick={handleToggleHost}
							className="flex items-center justify-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100"
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M2 12C4.5 7.5 8 5.5 12 5.5C16 5.5 19.5 7.5 22 12C19.5 16.5 16 18.5 12 18.5C8 18.5 4.5 16.5 2 12Z"
									stroke="#4A5EED"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<circle cx="12" cy="12" r="3" stroke="#4A5EED" strokeWidth="1.8" />
							</svg>
							{isHost ? 'View as Guest' : 'View as Host'}
						</button>
						<button
							onClick={() => navigate('/')}
							className="flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M14 7L19 12L14 17"
									stroke="#62748E"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<path
									d="M19 12H5"
									stroke="#62748E"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							Leave Room
						</button>
					</div>
				</header>

				<main className="mx-auto max-w-6xl px-6 pb-12">
					<h1 className="text-center text-4xl font-bold text-slate-900 md:text-5xl">
						Waiting Room
					</h1>

					<div className="mt-6 flex flex-wrap items-center justify-center gap-4">
						<div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm">
							<span className="text-slate-500">Room Code:</span>
							<span className="text-lg font-bold text-indigo-600">
								{roomCode}
							</span>
							<button className="text-slate-400 hover:text-slate-600">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<rect
										x="9"
										y="9"
										width="11"
										height="11"
										rx="2"
										stroke="currentColor"
										strokeWidth="1.6"
									/>
									<rect
										x="4"
										y="4"
										width="11"
										height="11"
										rx="2"
										stroke="currentColor"
										strokeWidth="1.6"
									/>
								</svg>
							</button>
						</div>
						<div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-600 shadow-sm">
							<img src={people} alt="Players" className="h-4 w-4" />
							{readyPlayers} / {totalPlayers} Players
						</div>
					</div>

					<div className="mt-8 flex flex-col items-center gap-6">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-indigo-500">
							<span className="text-base">👑</span>
							{isHost ? 'OWNER SETTINGS:' : 'ROOM SETTINGS:'}
						</div>

						<div className="flex flex-wrap items-center justify-center gap-8">
							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-slate-400">
									Sound Mode
								</p>
								<div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
									<button
										onClick={() => isHost && setSoundMode('kiwi')}
										disabled={!isHost}
										className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
											soundMode === 'kiwi'
												? 'bg-indigo-600 text-white'
												: 'text-slate-400'
										}`}
									>
										<img src={kiwi} alt="Kiwi" className="h-4 w-4" />
										Kiwi
									</button>
									<button
										onClick={() => isHost && setSoundMode('piano')}
										disabled={!isHost}
										className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
											soundMode === 'piano'
												? 'bg-indigo-600 text-white'
												: 'text-slate-400'
										}`}
									>
										<img src={music} alt="Music" className="h-4 w-4" />
										Piano
									</button>
								</div>
							</div>

							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-slate-400">
									Difficulty
								</p>
								<div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
									<button
										onClick={() => isHost && setDifficulty('easy')}
										disabled={!isHost}
										className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
											difficulty === 'easy'
												? 'bg-indigo-600 text-white'
												: 'text-slate-400'
										}`}
									>
										<span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
											<img src={circle} alt="Easy" className="h-3 w-3" />
										</span>
										Easy
									</button>
									<button
										onClick={() => isHost && setDifficulty('normal')}
										disabled={!isHost}
										className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
											difficulty === 'normal'
												? 'bg-indigo-600 text-white'
												: 'text-slate-400'
										}`}
									>
										<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200">
											<img src={normal} alt="Normal" className="h-3 w-3" />
										</span>
										Normal
									</button>
									<button
										onClick={() => isHost && setDifficulty('hard')}
										disabled={!isHost}
										className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
											difficulty === 'hard'
												? 'bg-indigo-600 text-white'
												: 'text-slate-400'
										}`}
									>
										<img src={fire} alt="Hard" className="h-4 w-4" />
										Hard
									</button>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-10 grid grid-cols-3 gap-6">
						{basePlayers.map((player) => (
							<div
								key={player.id}
								className={`relative min-h-40 rounded-2xl border-2 bg-white p-6 text-center shadow-sm transition ${
									player.isEmpty
										? 'border-slate-200 bg-white'
										: player.isReady
											? 'border-emerald-400'
											: 'border-indigo-400'
								}`}
							>
								{player.isEmpty ? (
									<div className="flex flex-col items-center justify-center gap-2 text-slate-400">
										<img src={human} alt="Waiting" className="h-8 w-8 opacity-60" />
										<span className="text-sm">Waiting...</span>
									</div>
								) : (
									<>
										<div className="relative -mt-1">
											<div className="text-5xl">{player.avatar}</div>
											{player.isHost && (
												<div className="absolute -top-9 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-yellow-400 shadow">
													<img src={golden} alt="Host" className="h-3.5 w-3.5" />
												</div>
											)}
										</div>
										<p className="mt-2 text-sm font-semibold text-slate-900">
											{player.username}
										</p>
										{player.isHost ? (
											<span className="mt-1 block text-[11px] font-semibold uppercase text-indigo-500">
												Room Owner
											</span>
										) : null}
										{player.isReady ? (
											<div className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1 text-xs font-semibold text-white">
												<svg
													width="14"
													height="14"
													viewBox="0 0 20 20"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path
														d="M5 10.5L8.2 13.5L15 7"
														stroke="white"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
												Ready
											</div>
										) : (
											<span className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
												Not Ready
											</span>
										)}
									</>
								)}
							</div>
						))}
					</div>

					<div className="mt-10 flex justify-center">
						{isHost ? (
							<button
								onClick={handleStartGame}
								disabled={!canStartGame}
								className={`flex items-center justify-center gap-2 rounded-full px-12 py-3 text-base font-semibold shadow-lg transition ${
									canStartGame
										? 'bg-indigo-600 text-white hover:bg-indigo-700'
										: 'bg-slate-200 text-slate-400'
								}`}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M6 4L15 10L6 16V4Z"
										fill="white"
									/>
								</svg>
								Start Game
							</button>
						) : (
							<button
								onClick={handleReady}
								className={`flex items-center justify-center gap-2 rounded-full px-12 py-3 text-base font-semibold shadow-lg transition ${
									currentUserReady
										? 'bg-emerald-500 text-white hover:bg-emerald-600'
										: 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
								}`}
							>
								{currentUserReady ? (
									<>
										<svg
											width="16"
											height="16"
											viewBox="0 0 20 20"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M5 10.5L8.2 13.5L15 7"
												stroke="white"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
										Ready!
									</>
								) : (
									'Click to Ready'
								)}
							</button>
						)}
					</div>
				</main>
			</div>
		</Background>
	)
}
