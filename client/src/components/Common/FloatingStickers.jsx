import { motion as Motion } from "framer-motion"
import { cn } from "../../lib/utils"

export default function FloatingStickers({
	stickers = [],
	className,
	baseDuration = 8,
	yOffset = -40,
	scalePeak = 1.05,
	rotateUp = 15,
	rotateDown = -10,
}) {
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
						animate={{
							y: [0, yOffset, 0],
							scale: [1, scalePeak, 1],
							rotate: [rotate, rotate + rotateUp, rotate + rotateDown, rotate],
						}}
						transition={{
							duration: baseDuration + delay,
							repeat: Infinity,
							ease: "easeInOut",
							delay,
						}}
					>
						<Icon size={size} strokeWidth={1.5} />
					</Motion.div>
				)
			})}
		</div>
	)
}
