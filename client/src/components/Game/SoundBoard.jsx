import * as React from "react"

import SoundPadButton from "./SoundPadButton"

import useGameStore from "../../store/useGameStore"

export default function SoundBoard({ icon: Icon, onPadPress, disabled = false, activePadIndex = null }) {
	const padThemes = useGameStore((state) => state.padThemes)
	const ensurePadThemes = useGameStore((state) => state.ensurePadThemes)

	React.useEffect(() => {
		ensurePadThemes()
	}, [ensurePadThemes])

	if (!padThemes) return null

	const padCount = padThemes.length
	const smColsClassName =
		padCount === 6
			? "sm:grid-cols-3"
			: padCount === 10
				? "sm:grid-cols-5"
				: "sm:grid-cols-4"

	return (
		<div className={`grid grid-cols-2 gap-4 ${smColsClassName}`}>
			{padThemes.map((bgClassName, padIndex) => (
				<SoundPadButton
					key={`${bgClassName}-${padIndex}`}
					bgClassName={bgClassName}
					Icon={Icon}
					label={`Sound pad ${padIndex + 1}`}
					disabled={disabled}
					isActive={typeof activePadIndex === "number" && activePadIndex === padIndex}
					onClick={() => onPadPress?.(padIndex)}
				/>
			))}
		</div>
	)
}
