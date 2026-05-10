import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
	Check,
	CircleDot,
	Copy,
	Flame,
	Landmark,
	LogOut,
	Music,
	PawPrint,
	Play,
	Users,
	Zap,
} from "lucide-react"

import BrandLockup from "../components/Common/BrandLockup"
import LoginButton from "../components/AuthComponent/LoginButton"
import RoomPill from "../components/Room/RoomPill"
import RoomSectionLabel from "../components/Room/RoomSectionLabel"
import SegmentedSelection from "../components/Room/SegmentedSelection"
import PlayerSlotCard from "../components/Room/PlayerSlotCard"
import { Button } from "../components/ui/button"
import SoundToggleButton from "../components/ui/SoundToggleButton"
import { useRoomSocketUpdates } from "../hooks/useSocketListeners"
import {
	useJoinRoomMutation,
	useLeaveRoomMutation,
	useSelectDifficultyMutation,
	useSelectModeMutation,
	useSetReadyMutation,
} from "../hooks/mutations/useRoomMutations"
import { useRoomQuery } from "../hooks/queries/useRoomQuery"
import { getApiErrorMessage, getStoredAuthToken, getStoredAuthUser } from "../api/axios"

import birdIcon from "../assets/icons/bird.svg"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import { emitGameRequestState, emitGameStart, joinSocketRoom, leaveSocketRoom, reconnectSocket } from "../socket/socket"

// NOTE (2026-04-29): The waiting room relies on two systems:
// - REST: join/leave room, ready/mode/difficulty — room participants and configuration
// - Socket: subscribe to room_update / game_state real-time broadcasts and auto-navigate when the game starts
// Important: use REST leaveRoom to exit the waiting room; socket leave_room means "leave the match = forfeit" in this app.

function BirdIcon({ className, ...props }) {
	const isActive = Boolean(props["data-active"])

	return (
		<img
			src={birdIcon}
			alt=""
			aria-hidden="true"
			className={"size-4 " + (className ?? "")}
			style={{
				filter: isActive ? "brightness(0) invert(1)" : "none",
			}}
		/>
	)
}

function AussieIcon({ className, ...props }) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			className={className}
			{...props}
		>
			<path d="M1.2736 2.47712L1.41317 3.70452C1.42208 3.93252 1.49826 4.17592 1.62521 4.3874V5.87857C1.62521 6.07195 1.53797 6.25516 1.38731 6.37636C1.08776 6.61727 0.915943 6.97597 0.915943 7.36035V9.68751L1.20614 10.8008C1.26692 11.0341 1.45711 11.2175 1.69565 11.2519C1.94306 11.2877 2.17985 11.1716 2.30317 10.9534C2.37805 10.8209 2.3939 10.663 2.35879 10.5149L2.12233 9.5177V8.40401L2.42403 7.96898C2.61281 8.34089 2.86983 8.78765 3.205 9.25348L2.97295 9.537C2.69894 9.87172 2.57265 10.3071 2.62427 10.7359C2.65574 10.9974 2.85231 11.2161 3.11312 11.2526C3.43678 11.2979 3.72483 11.0684 3.76257 10.7546L3.79815 10.4587L4.01398 10.2238C4.70088 10.9344 5.46648 11.4697 6.30293 11.8254C6.52699 12.727 7.07577 13.2473 7.27809 13.4135L7.64621 14.8662C7.68399 15.0153 7.65731 15.1571 7.57106 15.2655C7.48542 15.3732 7.35442 15.4311 7.20235 15.4276L7.19967 15.4275L5.52296 15.4292C5.25073 15.424 4.99497 15.5374 4.81313 15.7458C4.66395 15.9169 4.58851 16.1401 4.58851 16.367V16.5902H5.72821C5.66327 16.7175 5.62865 16.8592 5.62865 17.0066V17.2478H8.89364C9.53263 17.2478 10.0506 16.7298 10.0506 16.0908V13.3211C10.0506 13.0424 10.2685 12.8329 10.5553 12.8165L10.5759 12.814C10.5999 12.8112 10.6239 12.8069 10.6473 12.801C12.2148 12.4063 13.2254 11.1011 13.2254 9.46608C13.2254 8.96251 13.1172 8.48372 12.9231 8.05169C13.1076 8.30998 13.2533 8.60934 13.339 8.9572L14.3804 13.3989C14.6514 14.5547 15.2225 15.4985 15.9886 16.0564L16.0964 16.1349C15.6301 16.0741 15.1814 15.8409 14.7862 15.4514C14.3063 14.9784 13.9403 14.3114 13.7272 13.5209L13.281 11.9107C13.2455 11.7823 13.1126 11.7072 12.9843 11.7427L12.9841 11.7428C12.8558 11.7783 12.7806 11.9112 12.8161 12.0395L13.2619 13.6481C13.4968 14.5196 13.9068 15.2619 14.4477 15.795C15.0041 16.3435 15.6593 16.6334 16.3426 16.6334H17.6002L16.2726 15.6664C15.6097 15.1836 15.0912 14.317 14.8501 13.2888L13.808 8.84446C13.4329 7.32161 12.1225 6.60302 11.0893 6.26829L11.0893 6.26844C10.6807 6.09848 10.233 6.00441 9.76371 6.00441L9.2857 6.03721L7.36793 6.35684C7.32232 6.36444 7.27612 6.36712 7.2301 6.37164C7.10337 6.38404 7.00849 6.49306 7.01327 6.62028V6.62046C7.01851 6.75958 7.14011 6.86542 7.27864 6.85162C7.36986 6.84252 7.46092 6.83043 7.55117 6.81536L9.34233 6.51681L9.77195 6.48683C11.411 6.49121 12.743 7.826 12.743 9.46608C12.743 10.8957 11.8935 11.9925 10.5241 12.3346C9.99423 12.3511 9.56825 12.7873 9.56825 13.3211V16.0908C9.56825 16.4633 9.26622 16.7653 8.89368 16.7653H6.1838C6.2005 16.7403 6.21991 16.7169 6.24192 16.6954C6.3263 16.6127 6.43823 16.5681 6.55579 16.5711L8.11624 16.5711C8.70082 16.5711 9.1713 16.0974 9.15237 15.4944C9.15003 15.4191 9.13738 15.3445 9.11882 15.2715L8.42666 12.5481C8.50336 12.5686 8.58118 12.5844 8.65978 12.5954C8.80406 12.6158 8.93246 12.5019 8.93246 12.3562V12.3561C8.93246 12.2361 8.84406 12.1344 8.7252 12.1177C8.63577 12.1052 8.54786 12.0844 8.46232 12.0557C8.36992 12.0245 8.28019 11.9839 8.19576 11.9351C7.74117 11.6722 7.45873 11.1831 7.45873 10.6588C7.45873 10.5909 7.4633 10.5234 7.47239 10.4576C7.56171 9.80129 8.08392 9.29096 8.72587 9.19964C8.84447 9.18279 8.93242 9.08115 8.93242 8.96136V8.96102C8.93242 8.81548 8.80417 8.70137 8.66004 8.72174C7.80712 8.84235 7.11302 9.52034 6.99442 10.3921C6.98236 10.4791 6.97628 10.5689 6.97628 10.6588C6.97628 11.0095 7.07154 11.3483 7.24317 11.6428C6.16072 11.3448 5.1876 10.7499 4.34092 9.86779L4.53938 9.65178C5.15985 8.97639 5.43817 8.05478 5.29522 7.14886L5.2901 7.11632C5.26932 6.98476 5.14589 6.89496 5.01434 6.91574L5.01415 6.91578C4.88264 6.93656 4.79283 7.05998 4.81358 7.19154L4.8187 7.22405C4.93938 7.98917 4.70808 8.75514 4.18402 9.32551L3.33763 10.2468L3.28386 10.694C3.28 10.7259 3.26118 10.7555 3.23161 10.7681C3.17312 10.7931 3.11356 10.7547 3.10577 10.6987C3.0632 10.3933 3.15078 10.0812 3.34616 9.84259L3.93509 9.12319C4.19556 8.80505 4.29126 8.38293 4.19348 7.98356L3.95772 7.02043L3.93676 6.9271L3.85423 6.87511C3.83571 6.86286 3.43255 6.58806 3.22088 5.79827C3.18819 5.67629 3.06569 5.60099 2.94178 5.62545C2.80455 5.6525 2.71924 5.79051 2.75571 5.92559C2.96249 6.69145 3.33989 7.07676 3.50937 7.2177L3.7249 8.09827C3.78661 8.35035 3.7262 8.61676 3.5618 8.8176L3.52187 8.86632C2.98798 8.10023 2.67363 7.3923 2.53822 7.05223C2.49112 6.93392 2.36028 6.87295 2.2393 6.91259L2.23837 6.91288C2.1063 6.95615 2.03813 7.10155 2.08923 7.23076C2.1155 7.29715 2.14779 7.37579 2.18642 7.46489L1.63984 8.25309V9.57411L1.89233 10.639C1.90316 10.6846 1.88383 10.7179 1.87136 10.7336C1.85808 10.7504 1.82728 10.7793 1.77473 10.7756C1.73098 10.7724 1.68645 10.7311 1.67539 10.6886L1.39833 9.62565V7.35812C1.39833 7.11951 1.51121 6.89811 1.69595 6.74712C1.95768 6.53311 2.1076 6.21705 2.1076 5.87853V4.85613C2.22479 4.91473 2.34848 4.94601 2.47324 4.94601H2.74525C3.05864 4.94601 3.33444 4.75809 3.52629 4.49279C3.84558 5.37451 4.4446 6.13522 5.12507 6.47117C5.42655 6.61998 5.74692 6.72849 6.08042 6.79488C6.21724 6.82208 6.34879 6.72823 6.36716 6.58996V6.58977C6.3839 6.46397 6.30014 6.3467 6.17568 6.32195C5.88314 6.2638 5.60245 6.16884 5.3386 6.03859C4.61593 5.68185 3.97591 4.69118 3.80814 3.67498L3.93746 2.49219C4.20962 2.29009 4.61011 1.95626 4.7797 1.70529C5.2141 1.06281 5.13198 0.320365 5.12827 0.289082L5.10221 0.0691719L4.88089 0.0763711C4.83729 0.0777813 3.80791 0.118898 3.35507 0.788648C3.31974 0.840936 3.19179 1.03313 3.08369 1.22899C3.03207 1.22086 2.97948 1.21663 2.92631 1.21663H2.28528C2.22023 1.21663 2.1561 1.22301 2.09353 1.23511C1.97942 1.0155 1.82167 0.778443 1.78178 0.719439C1.3289 0.0496894 0.299519 0.00864649 0.255916 0.00719923L0.0345956 0L0.0085077 0.21991C0.00479676 0.25123 -0.0773263 0.993715 0.357076 1.63608C0.542957 1.91113 1.00593 2.28553 1.2736 2.47712ZM7.80775 12.2588C7.82667 12.2721 7.84586 12.2851 7.8653 12.2978L8.65329 15.3982C8.6777 15.4942 8.67607 15.5944 8.64779 15.692C8.57858 15.9309 8.35051 16.0887 8.1018 16.0887H6.56329L5.14292 16.09C5.14292 16.09 5.17684 16.0552 5.20252 16.0356C5.29637 15.9642 5.39742 15.9089 5.51565 15.9115L5.51832 15.9116L7.19503 15.9099C7.49644 15.9161 7.77027 15.7901 7.94869 15.5658C8.12822 15.3401 8.18842 15.0419 8.1139 14.7477L7.70336 13.1276L7.6297 13.0761C7.62402 13.0722 7.14846 12.733 6.87567 12.0377C7.17804 12.1335 7.48894 12.2071 7.80775 12.2588ZM3.75481 1.05888C3.96032 0.754953 4.38196 0.634682 4.65141 0.587813C4.63831 0.805941 4.58153 1.13729 4.3801 1.43517C4.29505 1.56104 4.09369 1.74852 3.89338 1.91432C3.84179 1.76941 3.76027 1.63597 3.65261 1.5256C3.61431 1.4863 3.57346 1.45068 3.53056 1.41851C3.59758 1.30098 3.67937 1.17047 3.75481 1.05888ZM2.74529 4.46366H2.47328C2.42863 4.46366 2.38288 4.45272 2.33731 4.43216C2.3864 4.33334 2.48816 4.26505 2.60583 4.26505C2.72484 4.26505 2.82756 4.33489 2.87602 4.43557C2.83346 4.45357 2.78963 4.46366 2.74529 4.46366ZM1.90339 1.86345C2.00625 1.7575 2.14189 1.69909 2.28528 1.69909H2.92634C3.06921 1.69909 3.20448 1.75709 3.30723 1.86241C3.40387 1.96149 3.46124 2.08978 3.47256 2.22909C3.47207 2.22938 3.47155 2.22979 3.47103 2.23005L3.47267 2.23269C3.474 2.2505 3.47486 2.26853 3.47467 2.28672L3.32494 3.6559L3.32356 3.67613C3.32037 3.80571 3.28014 3.94825 3.21561 4.07606C3.11579 3.95174 2.97893 3.85882 2.82181 3.81358V3.32244C2.82181 3.18925 2.71386 3.08134 2.58071 3.08134H2.58048C2.44734 3.08134 2.33938 3.18925 2.33938 3.32244V3.83028C2.20594 3.87886 2.08901 3.96195 2.00061 4.06979C1.93693 3.94306 1.89864 3.80438 1.89493 3.67939L1.73688 2.2898C1.7345 2.12789 1.79343 1.97678 1.90339 1.86345ZM1.38211 0.989633C1.47733 1.1305 1.58272 1.30154 1.65557 1.43847C1.62136 1.46586 1.5884 1.49536 1.55727 1.52742C1.45203 1.63586 1.37198 1.76629 1.32058 1.90787C1.097 1.72863 0.85282 1.50798 0.756781 1.36588C0.55717 1.07072 0.500133 0.73792 0.486514 0.518752C0.756113 0.565807 1.1769 0.686152 1.38211 0.989633Z" fill="currentColor" />
			<path d="M9.80933 9.18509H10.3141C10.4473 9.18509 10.5553 9.0771 10.5553 8.94388C10.5553 8.81066 10.4473 8.70267 10.3141 8.70267H9.80933C9.6761 8.70267 9.56812 8.81066 9.56812 8.94388C9.56812 9.0771 9.6761 9.18509 9.80933 9.18509Z" fill="currentColor" />
		</svg>
	)
}

export default function RoomPage() {
	const navigate = useNavigate()
	const { roomCode: roomCodeParam = "" } = useParams()
	// Background music is enabled on Landing + Room pages.
	useBackgroundMusic()

	const normalizedParamCode = String(roomCodeParam).trim().toUpperCase()
	const requestedJoinCode = normalizedParamCode === "NEW" ? "" : normalizedParamCode
	const [roomCode, setRoomCode] = useState("")
	const [setupError, setSetupError] = useState("")
	const [isStartingGame, setIsStartingGame] = useState(false)
	const [copyState, setCopyState] = useState("idle")

	const startedSetupRef = useRef(false)
	const hasNavigatedToGameRef = useRef(false)
	const copyResetTimerRef = useRef(null)

	useEffect(() => {
		startedSetupRef.current = false
		setSetupError("")
		setIsStartingGame(false)
	}, [normalizedParamCode])

	const joinRoomMutation = useJoinRoomMutation({
		onSuccess: (data) => {
			setSetupError("")
			setRoomCode(String(data?.roomCode ?? requestedJoinCode))
		},
		onError: (error) => {
			setSetupError(getApiErrorMessage(error))
		},
	})

	const leaveRoomMutation = useLeaveRoomMutation({
		onError: (error) => {
			setSetupError(getApiErrorMessage(error))
		},
	})

	const selectModeMutation = useSelectModeMutation()
	const selectDifficultyMutation = useSelectDifficultyMutation()
	const setReadyMutation = useSetReadyMutation()

	useEffect(() => {
		if (startedSetupRef.current) return
		startedSetupRef.current = true

		if (!requestedJoinCode) {
			setSetupError("Missing room code. Please go back and join/create from landing page.")
			navigate("/", { replace: true })
			return
		}

		const token = getStoredAuthToken()
		if (!token) {
			setSetupError("Missing session. Please join from the home page.")
			navigate("/", { replace: true })
			return
		}

		joinRoomMutation.mutate(requestedJoinCode)
	}, [joinRoomMutation, navigate, requestedJoinCode])

	const { data: roomState, isLoading: isRoomLoading, error: roomQueryError } = useRoomQuery(
		roomCode,
		Boolean(roomCode),
	)
	useRoomSocketUpdates(roomCode)

	const mode = roomState?.mode ?? "kiwi"
	const difficulty = roomState?.difficulty ?? "easy"

	const identity = useMemo(() => {
		const user = getStoredAuthUser()
		if (!user?.id) return null
		return { sub: String(user.id) }
	}, [])

	const hostUserId = roomState?.hostId ? String(roomState.hostId) : null
	const isHost = Boolean(identity?.sub) && Boolean(hostUserId) && identity.sub === hostUserId

	const players = useMemo(() => {
		const participants = roomState?.participants ?? []
		const mapped = participants.map((participant) => {
			const participantId = String(participant.userId)
			const isCurrentUser = Boolean(identity?.sub) && participantId === identity.sub
			return {
				id: participantId,
				username: isCurrentUser ? `${participant.username} (You)` : participant.username,
				avatarUrl: typeof participant.avatarUrl === "string" ? participant.avatarUrl : undefined,
				isHost: Boolean(hostUserId) && participantId === hostUserId,
				isReady: Boolean(participant.isReady),
			}
		})

		const maxCount = roomState?.maxParticipantCount ?? 6
		const emptySlots = Array.from({ length: Math.max(0, maxCount - mapped.length) }, (_, index) => ({
			id: `empty-${index + 1}`,
			isEmpty: true,
		}))

		return [...mapped, ...emptySlots]
	}, [hostUserId, identity?.sub, roomState?.maxParticipantCount, roomState?.participants])

	const nonEmptyPlayers = players.filter((player) => !player.isEmpty)
	const totalPlayers = roomState?.maxParticipantCount ?? players.length

	const currentUserPlayer = nonEmptyPlayers.find(
		(player) => Boolean(identity?.sub) && String(player.id) === identity.sub,
	)
	const currentUserReady = Boolean(currentUserPlayer?.isReady)

	const handleStartGame = () => {
		if (!isHost) return
		if (!canStartGame) return
		if (isStartingGame) return

		setSetupError("")
		setIsStartingGame(true)
		emitGameStart(roomCode, (response) => {
			setIsStartingGame(false)
			if (!response?.ok || !response?.game) {
				const message = typeof response?.error === "string" ? response.error : "Unable to start game"
				setSetupError(message)
				return
			}

			navigate(`/game/${roomCode}`, { state: { difficulty, soundMode: mode, roomCode } })
		})
	}

	const canStartGame = Boolean(isHost && roomState?.canStartGame)

	const handleCopyCode = async () => {
		if (!roomCode) return

		try {
			await navigator.clipboard.writeText(roomCode)
			setCopyState("success")
			if (copyResetTimerRef.current) {
				window.clearTimeout(copyResetTimerRef.current)
			}
			copyResetTimerRef.current = window.setTimeout(() => {
				setCopyState("idle")
				copyResetTimerRef.current = null
			}, 1800)
		} catch {
			setCopyState("error")
			if (copyResetTimerRef.current) {
				window.clearTimeout(copyResetTimerRef.current)
			}
			copyResetTimerRef.current = window.setTimeout(() => {
				setCopyState("idle")
				copyResetTimerRef.current = null
			}, 1800)
		}
	}

	const handleReady = () => {
		if (!roomCode) return
		setReadyMutation.mutate({ roomCode, isReady: !currentUserReady })
	}

	const errorMessage = setupError || (roomQueryError ? getApiErrorMessage(roomQueryError) : "")
	const isSettingUpRoom = joinRoomMutation.isPending
	const shouldShowRoomContent = !errorMessage && !isSettingUpRoom && !isRoomLoading && Boolean(roomCode)
	const user = getStoredAuthUser()
	const avatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl : undefined
	const loginLabel = typeof user?.username === "string" ? user.username : "Login"

	useEffect(() => {
		if (!roomCode) return
		joinSocketRoom(roomCode)
	}, [roomCode])

	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) {
				window.clearTimeout(copyResetTimerRef.current)
			}
		}
	}, [])

	useEffect(() => {
		hasNavigatedToGameRef.current = false
	}, [roomCode])

	useEffect(() => {
		if (!roomCode) return
		const socket = reconnectSocket()

		const maybeNavigateToGame = (gameState) => {
			const stateRoomCode = String(gameState?.roomCode ?? "").trim().toUpperCase()
			if (!stateRoomCode || stateRoomCode !== String(roomCode).toUpperCase()) return
			if (!gameState?.gameId) return
			if (gameState?.status === "finished") return

			// Only navigate players who are actually part of this server-side game.
			// This prevents late joiners (or non-participants) from being forced into
			// an in-progress game without ever clicking Skip during familiarization.
			if (!identity?.sub) return
			if (Array.isArray(gameState?.participantsOrder)) {
				const participantIds = gameState.participantsOrder.map((id) => String(id))
				if (!participantIds.includes(String(identity.sub))) return
			}
			if (Array.isArray(gameState?.eliminatedUserIds)) {
				const eliminatedIds = gameState.eliminatedUserIds.map((id) => String(id))
				if (eliminatedIds.includes(String(identity.sub))) return
			}

			if (hasNavigatedToGameRef.current) return
			hasNavigatedToGameRef.current = true
			navigate(`/game/${roomCode}`)
		}

		const requestStateOnce = () => {
			emitGameRequestState(roomCode, (response) => {
				if (response?.ok && response.game) maybeNavigateToGame(response.game)
			})
		}

		const onGameState = (gameState) => {
			maybeNavigateToGame(gameState)
		}
		const onConnect = () => {
			requestStateOnce()
		}

		socket.on("game_state", onGameState)
		socket.on("connect", onConnect)

		// If the game started before this client joined the socket room,
		// request current state once as a fallback.
		requestStateOnce()

		return () => {
			socket.off("game_state", onGameState)
			socket.off("connect", onConnect)
		}
	}, [identity?.sub, navigate, roomCode])

	return (
		<div className="min-h-screen w-full overflow-hidden bg-[#F6F8FF] bg-[radial-gradient(circle_at_94%_94%,rgba(168,116,255,0.28)_0,rgba(168,116,255,0.14)_18rem,rgba(246,248,255,0)_34rem)]">
			<div className="min-h-screen">
				<header className="flex items-center justify-between px-8 py-5">
					<BrandLockup />
					<div className="flex items-center gap-3">
						<SoundToggleButton />
						<LoginButton avatarUrl={avatarUrl} label={loginLabel} />
						<Button
							type="button"
							onClick={() => {
								if (!roomCode) {
									navigate("/")
									return
								}
								// NOTE (2026-04-29): First call REST leaveRoom() to remove the player from participants and broadcast room_update;
								// then emit socket leave_room (which has the game-side meaning of "leave the match").
								leaveRoomMutation.mutate(roomCode, {
									onSuccess: () => {
										leaveSocketRoom(roomCode)
										navigate("/")
									},
								})
							}}
							variant="outline"
							className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted"
						>
							<LogOut className="size-4" />
							Leave Room
						</Button>
					</div>
				</header>

				<main className="mx-auto max-w-6xl px-6 pb-0">
					<h1 className="text-center text-4xl font-bold text-foreground md:text-5xl">Waiting Room</h1>

					{isSettingUpRoom || isRoomLoading ? (
						<p className="mt-4 text-center text-sm font-medium text-muted-foreground">Loading room...</p>
					) : null}

					{errorMessage ? (
						<div className="mt-4 text-center">
							<p className="text-sm font-semibold text-destructive">{errorMessage}</p>
							<Button
								type="button"
								variant="outline"
								className="mt-4 rounded-full px-6 py-2 text-sm font-semibold"
								onClick={() => navigate("/")}
							>
								Back to Home
							</Button>
						</div>
					) : null}

					{shouldShowRoomContent ? (
						<>
							<div className="mt-6 flex flex-wrap items-center justify-center gap-4">
						<RoomPill>
							<span className="text-muted-foreground">Room Code:</span>
							<span className="text-lg font-bold text-primary">{roomCode}</span>
							<button
								type="button"
								onClick={handleCopyCode}
								className="text-muted-foreground hover:text-foreground"
								aria-label="Copy room code"
								title={
									copyState === "success"
										? "Copied!"
										: copyState === "error"
											? "Copy failed"
											: "Copy room code"
								}
							>
								{copyState === "success" ? (
									<Check className="size-4 text-emerald-500" />
								) : (
									<Copy className="size-4" />
								)}
							</button>
							<span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
								{copyState === "success" ? "Copied" : copyState === "error" ? "Copy failed" : ""}
							</span>
						</RoomPill>
						<RoomPill className="border-primary/20 bg-primary/10 text-primary">
							<Users className="size-4" />
							{nonEmptyPlayers.length} / {totalPlayers} Players
						</RoomPill>
					</div>

					<div className="mt-8 flex flex-col items-center gap-6">
						<RoomSectionLabel isHost={isHost} />

						<div className="flex flex-wrap items-start justify-center gap-8">
							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-muted-foreground">Sound Mode</p>
								<SegmentedSelection
									value={mode}
									disabled={!isHost}
									onChange={(next) => {
										if (!roomCode) return
										selectModeMutation.mutate({ roomCode, mode: next })
									}}
									options={[
										{ value: "kiwi", label: "Kiwi", Icon: BirdIcon },
										{ value: "piano", label: "Piano", Icon: Music },
										{ value: "maori", label: "Maori", Icon: Landmark },
										{ value: "animal", label: "Animal", Icon: PawPrint },
										{ value: "aussie", label: "Aussie", Icon: AussieIcon },
									]}
								/>
							</div>

							<div className="space-y-3 text-center">
								<p className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</p>
								<SegmentedSelection
									value={difficulty}
									disabled={!isHost}
									onChange={(next) => {
										if (!roomCode) return
										selectDifficultyMutation.mutate({ roomCode, difficulty: next })
									}}
									options={[
										{ value: "easy", label: "Easy", Icon: CircleDot },
										{ value: "medium", label: "Normal", Icon: Zap },
										{ value: "hard", label: "Hard", Icon: Flame },
									]}
								/>
							</div>
						</div>
					</div>

					<div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{players.map((player) => (
							<PlayerSlotCard
								key={player.id}
								player={player}
								isCurrentUser={!player.isEmpty && Boolean(identity?.sub) && String(player.id) === identity.sub}
							/>
						))}
					</div>

					<div className="mt-16 flex h-[109px] items-start justify-center px-6 py-6">
						{isHost ? (
							<Button
								type="button"
								onClick={handleStartGame}
								disabled={!canStartGame || isStartingGame}
								className="h-[60px] w-[227px] rounded-full bg-[linear-gradient(90deg,#4A5EED_0%,#505EED_11.11%,#565EED_22.22%,#5C5EED_33.33%,#625EED_44.44%,#675EED_55.56%,#6C5EED_66.67%,#715EED_77.78%,#765EED_88.89%,#7B5EED_100%)] px-0 text-[18px] font-bold leading-7 text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] hover:brightness-105"
							>
								<Play className="size-5 fill-current" />
								{isStartingGame ? "Starting..." : "Start Game"}
							</Button>
						) : (
							<Button
								type="button"
								onClick={handleReady}
								disabled={setReadyMutation.isPending}
								variant={currentUserReady ? "default" : "outline"}
								className={
									currentUserReady
										? "h-12 rounded-full px-12 text-base font-semibold ready-gradient-theme ready-shadow-theme"
										: "h-12 rounded-full px-12 text-base font-semibold shadow-lg"
								}
							>
								{currentUserReady ? (
									<>
										<Check className="size-4" />
										Ready!
									</>
								) : (
									"Click to Ready"
								)}
							</Button>
						)}
					</div>
					</>
				) : null}
				</main>
			</div>
		</div>
	)
}
