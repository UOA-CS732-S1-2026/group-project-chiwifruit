import { useNavigate } from 'react-router-dom'
import trophy from '../assets/trophy.svg'
import firstplace from '../assets/firstplace.svg'
import orangemedal from '../assets/orangemedal.svg'
import people from '../assets/people.svg'

export default function ResultsPage() {
	const navigate = useNavigate()

	// Mock data - in production this would come from game state
	const gameResults = {
		winner: {
			username: 'KeenRobin22',
			avatar: '👩‍🦰',
			correctNotes: 7,
		},
		topPerformers: [
			{
				username: 'KeenRobin22',
				avatar: '👩‍🦰',
				correctNotes: 7,
				rank: 1,
			},
			{
				username: 'WiseLark67',
				avatar: '🦅',
				correctNotes: 5,
				rank: 2,
			},
			{
				username: 'LuckyPhoenix60',
				avatar: '🔥',
				correctNotes: 3,
				rank: 3,
				isHost: true,
			},
		],
		fullRankings: [
			{
				rank: 1,
				username: 'KeenRobin22',
				avatar: '👩‍🦰',
				score: 7,
			},
			{
				rank: 2,
				username: 'WiseLark67',
				avatar: '🦅',
				score: 5,
			},
			{
				rank: 3,
				username: 'LuckyPhoenix60',
				avatar: '🔥',
				score: 3,
				isHost: true,
			},
		],
		matchStats: {
			totalRounds: 7,
			finalSequenceLength: 6,
			totalPlayers: 3,
		},
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
			<div className="max-w-6xl mx-auto">
				{/* Winner Section */}
				<div className="bg-gradient-to-b from-blue-50 to-yellow-50 border-4 border-yellow-400 rounded-2xl p-8 mb-8 shadow-lg">
					<div className="flex flex-col items-center">
						<div className="relative mb-4">
							<img
								src={trophy}
								alt="Trophy"
								className="w-20 h-20"
							/>
							<div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded">
								80 × 80
							</div>
						</div>
						<h1 className="text-4xl font-bold text-center mb-2">
							🎉 Winner! 🎉
						</h1>
						<p className="text-gray-600 text-center mb-6">
							Congratulations to the champion
						</p>

						{/* Winner Card */}
						<div className="flex items-center gap-4">
							<div className="text-5xl">{gameResults.winner.avatar}</div>
							<div>
								<h2 className="text-2xl font-bold text-gray-900">
									{gameResults.winner.username}
								</h2>
								<p className="text-gray-600">
									🎵 {gameResults.winner.correctNotes} correct notes
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Top Performers and Full Rankings */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
					{/* Top Performers */}
					<div className="bg-white rounded-xl p-6 shadow-md">
						<div className="flex items-center gap-2 mb-4">
							<span className="text-2xl">🏆</span>
							<div>
								<h3 className="font-bold text-lg text-gray-900">
									Top Performers
								</h3>
								<p className="text-sm text-gray-500">
									The best players of this match
								</p>
							</div>
						</div>

						<div className="space-y-3">
							{gameResults.topPerformers.map((player, index) => (
								<div
									key={index}
									className={`p-4 rounded-lg border-2 flex items-center justify-between ${
										index === 0
											? 'border-yellow-400 bg-yellow-50'
											: index === 1
												? 'border-gray-300 bg-white'
												: 'border-yellow-300 bg-yellow-50'
									}`}
								>
									<div className="flex items-center gap-3 flex-1">
										<div className="text-3xl">{player.avatar}</div>
										<div className="flex-1">
											<p className="font-semibold text-gray-900">
												{player.username}
											</p>
											<p className="text-sm text-gray-600">
												🎵 {player.correctNotes} correct notes
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{index === 0 && (
											<img
												src={firstplace}
												alt="1st"
												className="w-6 h-6"
											/>
										)}
										{index === 1 && (
											<img
												src={orangemedal}
												alt="Medal"
												className="w-6 h-6"
											/>
										)}
										{index === 2 && (
											<img
												src={orangemedal}
												alt="Medal"
												className="w-6 h-6"
											/>
										)}
										{player.isHost && (
											<span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
												Host
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Full Rankings */}
					<div className="bg-white rounded-xl p-6 shadow-md">
						<div className="flex items-center gap-2 mb-4">
							<span className="text-2xl">📊</span>
							<div>
								<h3 className="font-bold text-lg text-gray-900">
									Full Rankings
								</h3>
								<p className="text-sm text-gray-500">
									Complete results for all players
								</p>
							</div>
						</div>

						<div className="space-y-2">
							{gameResults.fullRankings.map((player) => (
								<div
									key={player.rank}
									className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
								>
									<div className="flex items-center gap-3 flex-1">
										<div className="w-8 h-8 flex items-center justify-center font-bold text-gray-600">
											{player.rank}
										</div>
										<div className="text-2xl">{player.avatar}</div>
										<div className="flex-1">
											<p className="font-semibold text-gray-900">
												{player.username}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										{player.isHost && (
											<span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
												Host
											</span>
										)}
										<p className="font-bold text-gray-900 w-8 text-right">
											{player.score}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Match Statistics */}
				<div className="bg-white rounded-xl p-6 shadow-md mb-8">
					<h3 className="font-bold text-lg text-gray-900 mb-2">
						Match Statistics
					</h3>
					<p className="text-sm text-gray-500 mb-6">
						Summary of this game session
					</p>

					<div className="grid grid-cols-3 gap-4">
						<div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 text-center">
							<p className="text-4xl font-bold text-blue-900">
								{gameResults.matchStats.totalRounds}
							</p>
							<p className="text-gray-600 text-sm mt-2">Total Rounds</p>
						</div>
						<div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 text-center">
							<p className="text-4xl font-bold text-purple-900">
								{gameResults.matchStats.finalSequenceLength}
							</p>
							<p className="text-gray-600 text-sm mt-2">Final Sequence Length</p>
						</div>
						<div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 text-center">
							<p className="text-4xl font-bold text-green-900">
								{gameResults.matchStats.totalPlayers}
							</p>
							<p className="text-gray-600 text-sm mt-2">Total Players</p>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<button
						onClick={() => navigate('/room')}
						className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2 shadow-md"
					>
						<span>↩️</span> Return to Lobby
					</button>
					<button
						onClick={() => navigate('/')}
						className="bg-white hover:bg-gray-50 text-gray-900 font-bold py-3 px-6 rounded-lg border-2 border-gray-200 transition flex items-center justify-center gap-2 shadow-md"
					>
						<span>🏠</span> Return Home
					</button>
				</div>
			</div>
		</div>
	)
}
