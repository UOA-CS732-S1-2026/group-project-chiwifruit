export default function Background({ children }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#F4F6FD]">
      <div className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#6BB5FF]/45 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 h-[32rem] w-[32rem] rounded-full bg-[#A874FF]/40 blur-[140px]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}


