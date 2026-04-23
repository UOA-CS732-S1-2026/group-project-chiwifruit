import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"

import BaseModal from "../ui/BaseModal"

function normalizeRoomCode(raw) {
	return raw
		.toUpperCase()
		.replace(/\s+/g, "")
		.replace(/[^A-Z0-9-]/g, "")
}

export default function JoinRoomModal({ open, onOpenChange, onJoin }) {
	const [roomCode, setRoomCode] = useState("")
	const inputRef = useRef(null)

	useEffect(() => {
		if (!open) return
		setRoomCode("")
	}, [open])

	useEffect(() => {
		if (!open) return
		const id = window.setTimeout(() => inputRef.current?.focus(), 0)
		return () => window.clearTimeout(id)
	}, [open])

	const normalizedRoomCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode])
	const canJoin = normalizedRoomCode.length > 0

	return (
		<BaseModal open={open} onOpenChange={onOpenChange}>
			<div className="relative w-[448px] max-w-[calc(100vw-32px)] rounded-[24px] bg-white shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
				<button
					type="button"
					onClick={() => onOpenChange?.(false)}
					className="absolute right-4 top-4 flex size-9 cursor-pointer items-center justify-center rounded-full px-2 pt-2 text-[#62748e] transition-colors hover:bg-[#f1f5f9] hover:text-[#091149] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5eed]/40"
					aria-label="Close"
				>
					<X className="size-5" />
				</button>

				<div className="px-8 pb-8 pt-8">
					<h2 className="text-[24px] font-bold leading-8 text-[#091149]">Join a Room</h2>
					<p className="mt-2 text-[16px] font-medium leading-6 text-[#62748e]">
						Enter the room code shared by your friend to join their game.
					</p>

					<div className="mt-6 flex flex-col gap-4">
						<form
							onSubmit={(event) => {
								event.preventDefault()
								if (!canJoin) return
								onJoin?.(normalizedRoomCode)
							}}
							className="flex flex-col gap-4"
						>
							<label className="sr-only" htmlFor="join-room-code">
								Room code
							</label>
							<input
								id="join-room-code"
								ref={inputRef}
								autoComplete="off"
								inputMode="text"
								value={roomCode}
								onChange={(event) => setRoomCode(event.target.value)}
								placeholder="e.g. ABCD-1234"
								className="h-16 w-full rounded-[14px] border-2 border-[#e2e8f0] bg-white px-5 text-[18px] font-medium text-[#091149] outline-none placeholder:text-[#90a1b9] focus:border-[#4a5eed]/40"
							/>

							<button
								type="submit"
								disabled={!canJoin}
								className={
									"h-[60px] w-full rounded-[14px] text-center text-[18px] font-bold leading-7 text-white shadow-[0px_4px_14px_0px_rgba(74,94,237,0.3)] transition-colors " +
									(canJoin
										? "bg-[#4a5eed] hover:bg-[#3f53e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5eed]/40"
										: "cursor-not-allowed bg-[#4a5eed] opacity-50")
								}
							>
								Join Game
							</button>
						</form>
					</div>
				</div>
			</div>
		</BaseModal>
	)
}
