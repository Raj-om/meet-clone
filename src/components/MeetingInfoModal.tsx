"use client"

import { useState } from "react"

interface Props {
    meetingId: string
    onClose: () => void
}

export default function MeetingInfoModal({ meetingId, onClose }: Props) {
    const [copied, setCopied] = useState(false)
    const meetingUrl = typeof window !== "undefined" ? `${window.location.origin}/meet/${meetingId}` : ""

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(meetingUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch { /* fallback */ }
    }

    const shareNative = () => {
        if (navigator.share) {
            navigator.share({ title: "Join my meeting", url: meetingUrl }).catch(() => { })
        } else {
            copyLink()
        }
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(meetingUrl)}`

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)"
        }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{
                background: "#292b2f", borderRadius: "16px", width: "400px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)", border: "1px solid #3c4043",
                overflow: "hidden"
            }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #3c4043", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ color: "white", margin: 0, fontSize: "16px" }}>📋 Meeting Info</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "20px", cursor: "pointer" }}>✕</button>
                </div>

                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* QR Code */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt="Meeting QR Code" style={{ borderRadius: "8px", background: "white", padding: "8px" }} />
                    </div>

                    {/* Meeting ID */}
                    <div style={{ background: "#3c4043", borderRadius: "8px", padding: "12px" }}>
                        <div style={{ color: "#9ca3af", fontSize: "11px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Meeting ID</div>
                        <div style={{ color: "white", fontSize: "18px", fontWeight: 700, letterSpacing: "2px", fontFamily: "monospace" }}>
                            {meetingId.length >= 9 ? meetingId.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3") : meetingId}
                        </div>
                    </div>

                    {/* Link */}
                    <div style={{ background: "#3c4043", borderRadius: "8px", padding: "12px" }}>
                        <div style={{ color: "#9ca3af", fontSize: "11px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Meeting Link</div>
                        <div style={{ color: "#8ab4f8", fontSize: "12px", wordBreak: "break-all" }}>{meetingUrl}</div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={copyLink} style={{
                            flex: 1, background: copied ? "#22c55e" : "#1a73e8", border: "none",
                            color: "white", borderRadius: "8px", padding: "10px", cursor: "pointer",
                            fontWeight: 600, fontSize: "13px", transition: "background 0.3s"
                        }}>
                            {copied ? "✓ Copied!" : "📋 Copy Link"}
                        </button>
                        <button onClick={shareNative} style={{
                            flex: 1, background: "#3c4043", border: "none",
                            color: "white", borderRadius: "8px", padding: "10px", cursor: "pointer",
                            fontWeight: 600, fontSize: "13px"
                        }}>
                            🔗 Share
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
