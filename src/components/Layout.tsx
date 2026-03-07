import type { ReactNode } from "react"
import BottomNav from "./BottomNav"

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen bg-creamy flex flex-col font-nunito">
      <div className="flex-1 pb-24 p-4 text-[#4A3B32]">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}