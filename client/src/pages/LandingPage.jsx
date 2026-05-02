import Background from "../components/Common/Background"
import bigLogo from "../assets/branding/biglogo.png"
import LandingTopBar from "../components/Landing/LandingTopBar"
import GuideCard from "../components/Landing/GuideCard"
import { Button } from "../components/ui/button"
import { Headphones, LogIn, Play, PlusCircle, Sparkles, Trophy } from "lucide-react"
import { useState } from "react"
import JoinRoomModal from "../components/Landing/JoinRoomModal"
import useBackgroundMusic from "../hooks/useBackgroundMusic"
import useGuardedRoomNavigation from "../hooks/useGuardedRoomNavigation"

export default function LandingPage() {
  useBackgroundMusic()

  const buildVersion = import.meta.env.VITE_BUILD_VERSION || 'local'

  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const {
    actionError,
    clearActionError,
    isPending,
    createRoomGuarded,
    joinRoomGuarded,
  } = useGuardedRoomNavigation()

  const guideItems = [
    {
      Icon: Headphones,
      title: "1. Listen closely",
      description: "Memorize the growing sequence of sounds played by the group.",
      iconWrapClassName: "bg-muted text-chart-2",
    },
    {
      Icon: PlusCircle,
      title: "2. Add your sound",
      description: "Successfully repeat the pattern and add your own unique sound to the end.",
      iconWrapClassName: "bg-muted text-chart-3",
    },
    {
      Icon: Trophy,
      title: "3. Last one standing",
      description: "Make a mistake and you're out. Outlast everyone else to win the game!",
      iconWrapClassName: "bg-muted text-chart-1",
    },
  ]

  return (
    <Background>
      <div className="fixed left-3 top-3 z-50 rounded-md bg-black/60 px-2 py-1 text-xs font-mono text-white">
        build: {buildVersion}
      </div>

      <LandingTopBar />

      <JoinRoomModal
        open={joinModalOpen}
        onOpenChange={(open) => {
          setJoinModalOpen(open)
          if (open) clearActionError()
        }}
        isSubmitting={isPending}
        onJoin={(roomCode) => {
          joinRoomGuarded(roomCode, {
            onSuccess: () => {
              setJoinModalOpen(false)
            },
          })
        }}
      />

      <section className="relative mx-auto w-full max-w-[90rem] px-4 pb-14 pt-24 md:px-6 md:pt-28 lg:px-8">
        {/* content unchanged */}
      </section>
    </Background>
  )
}
