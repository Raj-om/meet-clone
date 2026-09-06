import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "CLARIVOX · AI Core — Neural Intelligence System",
    description: "An immersive AI Core interface powered by quantum neural processing.",
}

export default function CoreLayout({ children }: { children: React.ReactNode }) {
    return children
}
