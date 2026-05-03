import * as React from "react"
import { useNavigate } from "react-router-dom"

import Background from "../components/Common/Background"
import GameResultsPanel from "../components/Game/GameResultsPanel"
import { useRankingQuery, useRoomQuery } from "../hooks/queries/useRoomQuery"
import { getStoredAuthUser } from "../api/axios"
import { clearCurrentRoomCode, leaveTrackedRoom, setCurrentRoomCode } from "../lib/roomLifecycle"

function buildPlayersFromRoom({ roomState, game, currentUserId, currentAvatarUrl }) {
	const participants = Array.isArray(roomState?.participants) ? roomState.participants : []
	const scores = game?.scores && typeof game.scores === "object" ? game.scores : {}
	const orderedIds = Array.isArray(game?.participantsOrder) && game.participantsOrder.length > 0
		? game.participantsOrder.map(String)
		: participants.map((participant) => String(participant.userId))
	const participantById = new Map(participants.map((participant) => [String(participant.userId), participant]))

	return orderedIds
		.map((participantId) => {
			const participant = participantById.get(String(participantId))
			if (!participant) return null
			const isCurrentUser = Boolean(currentUserId) && String(participantId) === String(currentUserId)
			const scoreFromGame = Number(scores[String(participantId)])
			return {
				id: String(participantId),
				name: isCurrentUser ? `${participant.username} (You)` : participant.username,
				score: Number.isFinite(scoreFromGame) ? scoreFromGame : Number(participant.correctCount ?? 0) || 0,
				avatarUrl: typeof participant.avatarUrl === "string" ? participant.avatarUrl : isCurrentUser ? currentAvatarUrl : undefined,
			}
		})
		.filter(Boolean)
}

export default function GameFinishedPage({ roomCode, game }) {
	const navigate = useNavigate()
	const user = getStoredAuthUser()
	const currentUserId = user?.id ? String(user.id) : null
	const currentAvatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const normalizedRoomCode = String(roomCode ?? game?.roomCode ?? "").trim().toUpperCase()

	const { data: roomState } = useRoomQuery(normalizedRoomCode, Boolean(normalizedRoomCode))
	const { data: rankingData } = useRankingQuery(normalizedRoomCode, Boolean(normalizedRoomCode))

	const players = React.useMemo(() => {
		const ranking = Array.isArray(rankingData?.ranking) ? rankingData.ranking : []
		if (ranking.length > 0) {
			return ranking.map((entry) => {
				const entryId = String(entry.userId)
				const isCurrentUser = Boolean(currentUserId) && entryId === String(currentUserId)
				return {
					id: entryId,
					name: isCurrentUser ? `${entry.username} (You)` : entry.username,
					score: Number(entry.correctCount ?? 0) || 0,
					avatarUrl: typeof entry.avatarUrl === "string" ? entry.avatarUrl : isCurrentUser ? currentAvatarUrl : undefined,
				}
			})
		}

		return buildPlayersFromRoom({ roomState, game, currentUserId, currentAvatarUrl })
	}, [currentAvatarUrl, currentUserId, game, rankingData?.ranking, roomState])

	const handleBackToRoom = () => {
		if (!normalizedRoomCode) {
			navigate("/", { replace: true })
			return
		}
		setCurrentRoomCode(normalizedRoomCode)
		navigate(`/room/${normalizedRoomCode}`, { replace: true })
	}

	const handleBackToHome = () => {
		Promise.resolve()
			.then(() => leaveTrackedRoom({ roomCode: normalizedRoomCode, clear: true }))
			.finally(() => {
				clearCurrentRoomCode(normalizedRoomCode)
				navigate("/", { replace: true })
			})
	}

	return (
		<Background>
			<div className="flex min-h-screen items-center justify-center px-6 py-12">
				<GameResultsPanel
					players={players}
					onBackToRoom={handleBackToRoom}
					onBackToHome={handleBackToHome}
				/>
			</div>
		</Background>
	)
}
