"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { cameraManager } from "@/utils/cameraManager"

type BgMode = "none" | "blur" | "image"

export default function LobbyPage() {
    const params = useParams<{ id: string }>()
    const meetingId = params.id
    const router = useRouter()

    const [displayName, setDisplayName] = useState("")
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [bgMode] = useState<BgMode>("none")
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
    const [mics, setMics] = useState<MediaDeviceInfo[]>([])
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [isJoining, setIsJoining] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    // Advanced Prefetch Algorithm
    useEffect(() => {
        if (displayName.trim().length > 1) {
            router.prefetch(`/meet/${meetingId}`)
        }
    }, [displayName, meetingId, router])

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            setCameras(devices.filter(d => d.kind === "videoinput"))
            setMics(devices.filter(d => d.kind === "audioinput"))
        })

        let mounted = true;
        cameraManager.getStream()
            .then(s => {
                if (!mounted) return;
                if (videoRef.current) {
                    videoRef.current.srcObject = s
                    videoRef.current.play().catch(e => console.warn("Lobby video interrupted:", e.message))
                }
            })
            .catch(e => console.error("Preview err:", e))
            
        return () => { 
            mounted = false;
        }
    }, [])

    const toggleMic = async () => {
        const stream = await cameraManager.getStream()
        stream.getAudioTracks().forEach(t => { t.enabled = isMuted })
        setIsMuted(v => !v)
    }
    const toggleVideo = async () => {
        const stream = await cameraManager.getStream()
        stream.getVideoTracks().forEach(t => { t.enabled = isVideoOff })
        setIsVideoOff(v => !v)
    }

    const join = () => {
        setIsJoining(true) // Trigger visual transition instantly
        // DO NOT stop tracks here to allow smooth camera transition
        const name = displayName.trim() || "Guest"
        // Store the display name in sessionStorage to be picked up by the meeting page
        sessionStorage.setItem("meet-display-name", name)
        sessionStorage.removeItem("meet-companion-mode")
        
        // Use a tiny timeout to allow the React state (spinner) to render before blocking the thread with router.push
        setTimeout(() => {
            router.push(`/meet/${meetingId}`)
        }, 50)
    }

    const joinCompanion = () => {
        setIsJoining(true)
        const name = (displayName.trim() || "Guest") + " (Companion)"
        sessionStorage.setItem("meet-display-name", name)
        sessionStorage.setItem("meet-companion-mode", "true")
        
        setTimeout(() => {
            router.push(`/meet/${meetingId}`)
        }, 50)
    }

    const BG_OPTIONS: { label: string; value: BgMode; icon: string }[] = [
        { label: "None", value: "none", icon: "🚫" },
        { label: "Blur", value: "blur", icon: "◌" },
        { label: "Space", value: "image", icon: "🌌" },
    ]

    return (
        <div style={{
            minHeight: "100vh", 
            background: "radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0b0f19 60%, #000000 100%)",
            display: "flex", flexDirection: "column", alignItems: "center",
            fontFamily: "'Inter', 'Google Sans', sans-serif", padding: "40px 20px"
        }}>
            {/* Logo Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", animation: "fadeDown 0.8s ease-out" }}>
                <img src="/clarivox-logo.png" alt="CLARIVOX" style={{ width: 36, height: 36, borderRadius: 8, boxShadow: "0 0 15px rgba(124,58,237,0.8)" }} />
                <span style={{ fontSize: "28px", fontWeight: 800, background: "linear-gradient(135deg, #a78bfa, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.08em" }}>CLARIVOX</span>
            </div>

            <div style={{ 
                display: "flex", gap: "40px", maxWidth: "960px", width: "100%", flexWrap: "wrap",
                background: "rgba(255, 255, 255, 0.02)", backdropFilter: "blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "24px", padding: "32px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                {/* Camera preview */}
                <div style={{ flex: "1 1 450px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", background: "#0a0a0a", aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)" }}>
                        <video
                            ref={videoRef}
                            muted
                            autoPlay
                            playsInline
                            style={{
                                width: "100%", height: "100%", objectFit: "cover",
                                transform: "scaleX(-1)",
                                display: isVideoOff ? "none" : "block"
                            }}
                        />
                        {isVideoOff && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle, #1f2937, #111827)" }}>
                                <div style={{
                                    width: "90px", height: "90px", borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: 600, color: "white",
                                    boxShadow: "0 10px 25px rgba(124,58,237,0.5)"
                                }}>
                                    {displayName.charAt(0).toUpperCase() || "?"}
                                </div>
                            </div>
                        )}

                        {/* Mic/Video quick toggles on preview */}
                        <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "16px" }}>
                            <button onClick={toggleMic} style={{
                                width: "48px", height: "48px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)",
                                background: isMuted ? "#ef4444" : "rgba(15,23,42,0.7)", color: "white",
                                cursor: "pointer", fontSize: "20px", backdropFilter: "blur(8px)",
                                transition: "all 0.2s", boxShadow: isMuted ? "0 0 15px rgba(239,68,68,0.5)" : "none"
                            }} onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>{isMuted ? "🔇" : "🎤"}</button>
                            <button onClick={toggleVideo} style={{
                                width: "48px", height: "48px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)",
                                background: isVideoOff ? "#ef4444" : "rgba(15,23,42,0.7)", color: "white",
                                cursor: "pointer", fontSize: "20px", backdropFilter: "blur(8px)",
                                transition: "all 0.2s", boxShadow: isVideoOff ? "0 0 15px rgba(239,68,68,0.5)" : "none"
                            }} onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>{isVideoOff ? "📵" : "📹"}</button>
                        </div>
                    </div>

                    {/* Background effects */}
                    <div>
                        <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Background Effects</div>
                        <div style={{ display: "flex", gap: "12px" }}>
                            {BG_OPTIONS.map(opt => (
                                <button key={opt.value} style={{
                                    flex: 1, padding: "12px 0", borderRadius: "10px", cursor: "pointer",
                                    background: bgMode === opt.value ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255,255,255,0.05)",
                                    border: bgMode === opt.value ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)",
                                    color: "white", fontSize: "13px", fontWeight: 600,
                                    transition: "all 0.3s", boxShadow: bgMode === opt.value ? "0 0 15px rgba(124,58,237,0.4)" : "none"
                                }}>
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "24px", justifyContent: "center" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                            <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #0ea5e9, #2563eb)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(14,165,233,0.5)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                    <path d="M17 10.5V7C17 6.44772 16.5523 6 16 6H6C5.44772 6 5 6.44772 5 7V17C5 17.5523 5.44772 18 6 18H16C16.5523 18 17 17.5523 17 17V13.5L21 17.5V6.5L17 10.5Z" />
                                </svg>
                            </div>
                            <span style={{ color: "white", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" }}>Ready to join?</span>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "15px", margin: 0 }}>
                            Meeting ID: <span style={{ color: "#38bdf8", fontFamily: "monospace", letterSpacing: "1.5px", background: "rgba(56,189,248,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                                {meetingId?.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3") || meetingId}
                            </span>
                        </p>
                    </div>

                    {/* Display name */}
                    <div>
                        <label style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "8px", fontWeight: 600 }}>Your name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && join()}
                            placeholder="Enter your display name"
                            autoFocus
                            style={{
                                width: "100%", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "10px", color: "white", padding: "14px 16px",
                                fontSize: "15px", outline: "none", boxSizing: "border-box", transition: "all 0.3s",
                                backdropFilter: "blur(10px)"
                            }}
                            onFocus={e => { e.target.style.borderColor = "#8b5cf6"; e.target.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.2)" }}
                            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; e.target.style.boxShadow = "none" }}
                        />
                    </div>

                    {/* Device selectors */}
                    {cameras.length > 1 && (
                        <div>
                            <label style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "8px", fontWeight: 600 }}>Camera</label>
                            <select style={{ width: "100%", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", padding: "12px 14px", fontSize: "14px", outline: "none", backdropFilter: "blur(10px)" }}>
                                {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                            </select>
                        </div>
                    )}
                    {mics.length > 1 && (
                        <div>
                            <label style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "8px", fontWeight: 600 }}>Microphone</label>
                            <select style={{ width: "100%", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", padding: "12px 14px", fontSize: "14px", outline: "none", backdropFilter: "blur(10px)" }}>
                                {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Join button */}
                    <button 
                        onClick={join} 
                        disabled={isJoining}
                        style={{
                            marginTop: "10px",
                            background: isJoining ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                            border: isJoining ? "1px solid rgba(255,255,255,0.2)" : "none", 
                            color: isJoining ? "#94a3b8" : "white", borderRadius: "12px",
                            padding: "16px", fontSize: "16px", fontWeight: 700, letterSpacing: "0.5px",
                            cursor: isJoining ? "wait" : "pointer",
                            boxShadow: isJoining ? "none" : "0 8px 25px rgba(124,58,237,0.4)",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                            position: "relative", overflow: "hidden"
                        }}
                        onMouseEnter={e => !isJoining && (e.currentTarget.style.transform = "translateY(-2px)")}
                        onMouseLeave={e => !isJoining && (e.currentTarget.style.transform = "translateY(0)")}
                        onMouseDown={e => !isJoining && (e.currentTarget.style.transform = "scale(0.97)")}
                        onMouseUp={e => !isJoining && (e.currentTarget.style.transform = "translateY(-2px)")}
                    >
                        {isJoining ? (
                            <>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
                                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
                                </svg>
                                <span>Securing AI Tunnel...</span>
                            </>
                        ) : (
                            "Join Meeting Now"
                        )}
                        
                        {/* CSS animations */}
                        <style dangerouslySetInnerHTML={{__html: `
                            @keyframes spin { 100% { transform: rotate(360deg); } }
                            @keyframes fadeDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                        `}} />
                    </button>

                    <button
                        onClick={joinCompanion}
                        disabled={isJoining}
                        style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#94a3b8", borderRadius: "12px",
                            padding: "12px", fontSize: "14px", fontWeight: 600,
                            cursor: isJoining ? "wait" : "pointer",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={e => !isJoining && (e.currentTarget.style.background = "rgba(255,255,255,0.05)", e.currentTarget.style.color = "white")}
                        onMouseLeave={e => !isJoining && (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "#94a3b8")}
                    >
                        📱 Join in Companion Mode (No Audio/Video)
                    </button>
                </div>
            </div>
        </div>
    )
}
