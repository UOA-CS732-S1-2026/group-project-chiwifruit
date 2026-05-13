import { motion as Motion, useReducedMotion } from "framer-motion"
import { cn } from "../../lib/utils"

// Helper: build the sticker motion keyframes while respecting reduced-motion settings.
function buildStickerAnimation({ shouldReduceMotion, rotate, yOffset, scalePeak, rotateUp, rotateDown }) {
	if (shouldReduceMotion) {
		return { y: 0, scale: 1, rotate }
	}

	return {
		y: [0, yOffset, 0],
		scale: [1, scalePeak, 1],
		rotate: [rotate, rotate + rotateUp, rotate + rotateDown, rotate],
	}
}

// Helper: build the repeating sticker transition for either animated or reduced-motion mode.
function buildStickerTransition({ shouldReduceMotion, baseDuration, delay }) {
	if (shouldReduceMotion) {
		return { duration: 0 }
	}

	return {
		duration: baseDuration + delay,
		repeat: Infinity,
		ease: "easeInOut",
		delay,
	}
}

// Component: render decorative floating stickers with gentle looping motion in
// the shared background layer.
export default function FloatingStickers({
	stickers = [],
	className,
	baseDuration = 8,
	yOffset = -40,
	scalePeak = 1.05,
	rotateUp = 15,
	rotateDown = -10,
}) {
	// State: mirror the user's reduced-motion preference so decorative animation can back off.
	const shouldReduceMotion = useReducedMotion()

	return (
		<div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
			{stickers.map((sticker) => {
				const {
					id,
					Icon,
					color,
					size,
					top,
					left,
					rotate = 0,
					delay = 0,
				} = sticker

				return (
					<Motion.div
						key={id}
						className={cn("absolute mix-blend-multiply", color)}
						style={{ top, left }}
						animate={buildStickerAnimation({ shouldReduceMotion, rotate, yOffset, scalePeak, rotateUp, rotateDown })}
						transition={buildStickerTransition({ shouldReduceMotion, baseDuration, delay })}
					>
						<Icon size={size} strokeWidth={1.5} />
					</Motion.div>
				)
			})}
		</div>
	)
}
