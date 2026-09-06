"use client"

import dynamic from "next/dynamic"

// Load 3D WebGL scene client-side only (no SSR)
const AICoreScene = dynamic(() => import("@/components/AICoreScene"), {
    ssr: false,
    loading: () => null,
})

const AICoreOverlay = dynamic(() => import("@/components/AICoreOverlay"), {
    ssr: false,
    loading: () => null,
})

export default function CorePage() {
    return (
        <div style={{
            width: "100vw",
            height: "100vh",
            background: "#02030A",
            overflow: "hidden",
            position: "relative",
            cursor: "none", // we have a custom cursor
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            {/* ── Noise texture overlay ── */}
            <div style={{
                position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
                opacity: 0.4
            }} />

            {/* ── 3D WebGL Canvas (background) ── */}
            <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
                <AICoreScene />
            </div>

            {/* ── Glassmorphic UI Overlay (foreground) ── */}
            <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
                <AICoreOverlay />
            </div>
        </div>
    )
}
