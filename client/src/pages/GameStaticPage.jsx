import './GameStaticPage.css'

const playersLeft = [
	{ name: 'Alex (You)', status: 'CURRENT TURN', score: 0, badge: '18', active: true },
	{ name: 'Jordan', status: 'WAITING', score: 0, active: false },
	{ name: 'Casey', status: 'WAITING', score: 0, active: false },
]

const playersRight = [
	{ name: 'Riley', status: 'WAITING', score: 0 },
	{ name: 'Taylor', status: 'WAITING', score: 0 },
	{ name: 'Sam', status: 'WAITING', score: 0 },
]

export default function GameStaticPage() {
	return (
		<div className="game-static">
			<header className="game-static__topbar">
				<button className="game-static__exit" type="button">
					Exit Game
				</button>
				<div className="game-static__length">
					<span className="game-static__length-label">SEQUENCE LENGTH</span>
					<span className="game-static__length-value">0</span>
				</div>
				<button className="game-static__sound" type="button" aria-label="Sound">
					<span className="game-static__sound-icon" />
				</button>
			</header>

			<main className="game-static__main">
				<section className="game-static__players game-static__players--left">
					{playersLeft.map((player) => (
						<div
							key={player.name}
							className={`player-card ${player.active ? 'player-card--active' : ''}`}
						>
							<div className="player-card__avatar" aria-hidden="true">
								<span>{player.name.split(' ')[0][0]}</span>
							</div>
							<div className="player-card__body">
								<p className="player-card__name">{player.name}</p>
								<p
									className={`player-card__status ${
										player.active ? 'player-card__status--active' : ''
									}`}
								>
									{player.status}
								</p>
								<p className="player-card__score">Score: {player.score}</p>
							</div>
							{player.badge ? (
								<div className="player-card__badge">{player.badge}</div>
							) : null}
						</div>
					))}
				</section>

				<section className="game-static__center">
					<div className="progress">
						<div className="progress__row">
							<span className="progress__label">INPUT PROGRESS</span>
							<span className="progress__value">0 / 1</span>
						</div>
						<div className="progress__bar">
							<div className="progress__fill" />
						</div>
						<div className="progress__hint">ADD A NEW NOTE!</div>
					</div>

					<div className="note-wheel">
						<div className="note-wheel__ring">
							<div className="note note--yellow" />
							<div className="note note--cyan" />
							<div className="note note--pink" />
							<div className="note note--green" />
							<div className="note note--purple" />
							<div className="note note--red" />
							<div className="note-wheel__core">
								<div className="note-wheel__logo">K</div>
							</div>
						</div>
					</div>

					<div className="game-static__toast">
						<span className="game-static__toast-icon" />
						<span>Game started! You go first. Press any note.</span>
					</div>
				</section>

				<section className="game-static__players game-static__players--right">
					{playersRight.map((player) => (
						<div key={player.name} className="player-card">
							<div className="player-card__avatar" aria-hidden="true">
								<span>{player.name[0]}</span>
							</div>
							<div className="player-card__body">
								<p className="player-card__name">{player.name}</p>
								<p className="player-card__status">{player.status}</p>
								<p className="player-card__score">Score: {player.score}</p>
							</div>
						</div>
					))}
				</section>
			</main>
		</div>
	)
}
