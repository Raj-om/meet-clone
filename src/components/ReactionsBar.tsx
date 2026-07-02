"use client"

import { useState } from "react"

const REACTIONS = ["👍", "❤️", "😂", "😮", "👏", "🎉", "😢", "🔥"]

interface Props {
    onReact: (emoji: string) => void
}

export default function ReactionsBar({ onReact }: Props) {
    const [open, setOpen] = useState(false)

    return (
        <div style={{ position: "relative" }}>
            <button
                onClick={() => setOpen(v => !v)}
                title="React"
                style={{
                    width: "50px", height: "50px", borderRadius: "50%",
                    background: open ? "#1a73e8" : "#3c4043",
                    color: "white", border: "none", fontSize: "20px",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s"
                }}
            >
                😊
            </button>

            {open && (
                <div style={{
                    position: "absolute", bottom: "60px", left: "50%", transform: "translateX(-50%)",
                    background: "#292b2f", borderRadius: "30px", padding: "8px 12px",
                    display: "flex", gap: "6px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    border: "1px solid #3c4043", animation: "slideUp 0.15s ease"
                }}>
                    {REACTIONS.map(emoji => (
                        <button key={emoji} onClick={() => { onReact(emoji); setOpen(false) }} style={{
                            background: "none", border: "none", fontSize: "24px", cursor: "pointer",
                            padding: "4px", borderRadius: "8px", transition: "transform 0.1s, background 0.15s",
                            lineHeight: 1
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.3)"; e.currentTarget.style.background = "#3c4043" }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "none" }}
                        >{emoji}</button>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { opacity:0; transform: translateX(-50%) translateY(10px); }
                    to   { opacity:1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    )
}
