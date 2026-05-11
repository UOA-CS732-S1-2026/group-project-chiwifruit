import FloatingStickers from "./FloatingStickers"

export default function Background({ children, stickers = [] }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-[color:var(--hero-glow-top)]/45 blur-[7.5rem]" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 h-[32rem] w-[32rem] rounded-full bg-[color:var(--hero-glow-bottom)]/40 blur-[8.75rem]" />
	  <FloatingStickers stickers={stickers} className="z-0" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}


