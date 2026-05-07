import * as React from "react"

import { ArrowLeftFromLine, House } from "lucide-react"

import BaseModal from "../ui/BaseModal"

import trophyIcon from "../../assets/icons/Trophy.svg"
import medal1Icon from "../../assets/icons/Medal1.svg"
import medal2Icon from "../../assets/icons/Medal2.svg"
import medal3Icon from "../../assets/icons/Medal3.svg"
import medal4Icon from "../../assets/icons/Medal4.svg"
import medal5Icon from "../../assets/icons/Medal5.svg"
import medal6Icon from "../../assets/icons/Medal6.svg"

// NOTE (2026-04-29): Results Modal 仅做“展示排名 + 返回操作”。
// 真实的离房/判负语义由 GamePage 负责（Back to Home 会先 REST leaveRoom 再导航）。

const MEDAL_BY_RANK = [medal1Icon, medal2Icon, medal3Icon, medal4Icon, medal5Icon, medal6Icon]

function getInitials(name) {
	if (!name) return ""
	const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean)
	if (words.length === 0) return ""
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
	return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function ResultsRow({
	index,
	name,
	points,
	avatarUrl,
	isOnline = true,
	variant,
}) {
	const rank = index + 1
	const medalSrc = MEDAL_BY_RANK[rank - 1]
	const rankBadge = medalSrc ? (
		<img alt="" aria-hidden="true" src={medalSrc} className="size-6" />
	) : (
		<span className="text-[16px] font-bold leading-6 text-[#90a1b9]">#{rank}</span>
	)

	const containerClassName =
		variant === "winner"
			? "bg-[#fefce8] border-2 border-[#fdc700]"
			: variant === "podium"
				? "bg-[#f8fafc] border-2 border-[#e2e8f0]"
				: "bg-white border border-[#f1f5f9]"

	const rowSizeClassName =
		variant === "winner"
			? "h-[71.4px] p-[14px]"
			: variant === "podium"
				? "h-[69.5px] p-[14px]"
				: "h-[66px] p-[13px]"

	const pointsClassName =
		variant === "winner" ? "text-[#d08700]" : variant === "podium" ? "text-[#314158]" : "text-[#62748e]"

	const nameClassName =
		variant === "winner" ? "text-[#a65f00]" : "text-[#314158]"

	return (
		<div className={`flex items-center justify-between rounded-[16px] ${rowSizeClassName} ${containerClassName}`}>
			<div className="flex items-center gap-3">
				<div className="flex w-8 items-center justify-center">{rankBadge}</div>

				<div className="relative h-10 w-10 rounded-full border-2 border-white bg-[#e2e8f0] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
					{avatarUrl ? (
						<img
							alt={name}
							src={avatarUrl}
							className="absolute inset-0 size-full rounded-full object-cover"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center rounded-full text-xs font-bold text-[#314158]">
							{getInitials(name)}
						</div>
					)}
					{isOnline ? (
						<span className="absolute bottom-0 right-0 size-[10px] rounded-full border-2 border-white bg-[#00c950]" />
					) : null}
				</div>

				<div className="flex flex-col">
					<div className={`text-[14px] font-bold leading-5 ${nameClassName}`}>{name}</div>
					<div className="text-[10px] font-bold leading-[15px] tracking-[0.5px] text-[#90a1b9] uppercase">
						ONLINE
					</div>
				</div>
			</div>

			<div className="flex flex-col items-end">
				<div className={`text-[18px] font-bold leading-7 ${pointsClassName}`}>{points}</div>
				<div className="text-[9px] font-bold leading-[13.5px] tracking-[0.45px] text-[#90a1b9] uppercase">
					POINTS
				</div>
			</div>
		</div>
	)
}

export default function GameResultsModal({ open, ranking, onBackToRoom, onBackToHome, onClose }) {
	const sortedPlayers = React.useMemo(() => {
		const safePlayers = Array.isArray(ranking) ? ranking : []
		return [...safePlayers].sort((a, b) => (b?.correctCount ?? 0) - (a?.correctCount ?? 0))
	}, [ranking])

	return (
		<BaseModal
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose?.()
			}}
		>
			<div className="relative w-[448px] max-w-[calc(100vw-2rem)] rounded-[32px] bg-white px-8 pb-8 pt-12">
				<div className="absolute -top-8 left-1/2 -translate-x-1/2">
					<div className="flex size-16 items-center justify-center rounded-full bg-[#fdc700] shadow-[0px_0px_25px_0px_rgba(250,204,21,0.5)]">
						<img alt="" aria-hidden="true" src={trophyIcon} className="size-10" />
					</div>
				</div>

				<h2 className="text-center text-[30px] font-bold leading-9 tracking-[-0.75px] text-[#1d293d]">Game Over!</h2>
				<p className="mt-1 text-center text-[14px] font-medium leading-5 text-[#62748e]">Here is how everyone did</p>

				<div className="mt-6 flex flex-col gap-2">
					{sortedPlayers.map((player, index) => {
						const variant = index === 0 ? "winner" : index <= 2 ? "podium" : "normal"
						return (
							<ResultsRow
								key={player.userId ?? `${player.username}-${index}`}
								index={index}
								name={player.username}
								points={player.correctCount ?? 0}
								avatarUrl={player.avatarUrl}
								isOnline
								variant={variant}
							/>
						)
					})}
				</div>

				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={onBackToRoom}
						className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#f1f5f9] text-[14px] font-bold leading-5 text-[#45556c] transition-colors hover:bg-[#e2e8f0]"
					>
						<ArrowLeftFromLine className="size-[18px]" />
						<span>Back to Room</span>
					</button>
					<button
						type="button"
						onClick={onBackToHome}
						className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#1d293d] text-[14px] font-bold leading-5 text-white shadow-[0px_4px_0px_0px_#0f172a] transition-colors hover:bg-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
					>
						<House className="size-[18px]" />
						<span>Back to Home</span>
					</button>
				</div>
			</div>
		</BaseModal>
	)
}
