"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"

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

        navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, min: 30 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 2 }
        }).then(s => {
            setStream(s)
            if (videoRef.current) {
                videoRef.current.srcObject = s
                videoRef.current.play().catch(e => console.warn("Lobby video interrupted:", e.message))
            }
        }).catch(() => { })

        return () => { stream?.getTracks().forEach(t => t.stop()) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggleMic = () => {
        stream?.getAudioTracks().forEach(t => { t.enabled = isMuted })
        setIsMuted(v => !v)
    }
    const toggleVideo = () => {
        stream?.getVideoTracks().forEach(t => { t.enabled = isVideoOff })
        setIsVideoOff(v => !v)
    }

    const join = () => {
        setIsJoining(true) // Trigger visual transition instantly
        stream?.getTracks().forEach(t => t.stop())
        const name = displayName.trim() || "Guest"
        // Store the display name in sessionStorage to be picked up by the meeting page
        sessionStorage.setItem("meet-display-name", name)
        
        // Use a tiny timeout to allow the React state (spinner) to render before blocking the thread with router.push
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
            minHeight: "100vh", background: "#202124", display: "flex", alignItems: "center",
            justifyContent: "center", fontFamily: "'Google Sans', sans-serif", padding: "20px"
        }}>
            <div style={{ display: "flex", gap: "32px", maxWidth: "900px", width: "100%", flexWrap: "wrap" }}>
                {/* Camera preview */}
                <div style={{ flex: "1 1 400px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
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
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#303134" }}>
                                <div style={{
                                    width: "80px", height: "80px", borderRadius: "50%", background: "#5f6368",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px"
                                }}>
                                    {displayName.charAt(0).toUpperCase() || "?"}
                                </div>
                            </div>
                        )}

                        {/* Mic/Video quick toggles on preview */}
                        <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "10px" }}>
                            <button onClick={toggleMic} style={{
                                width: "42px", height: "42px", borderRadius: "50%", border: "none",
                                background: isMuted ? "#ea4335" : "rgba(0,0,0,0.6)", color: "white",
                                cursor: "pointer", fontSize: "18px", backdropFilter: "blur(4px)"
                            }}>{isMuted ? "🔇" : "🎤"}</button>
                            <button onClick={toggleVideo} style={{
                                width: "42px", height: "42px", borderRadius: "50%", border: "none",
                                background: isVideoOff ? "#ea4335" : "rgba(0,0,0,0.6)", color: "white",
                                cursor: "pointer", fontSize: "18px", backdropFilter: "blur(4px)"
                            }}>{isVideoOff ? "📵" : "📹"}</button>
                        </div>
                    </div>

                    {/* Background effects */}
                    <div>
                        <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Background effects</div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {BG_OPTIONS.map(opt => (
                                <button key={opt.value} style={{
                                    flex: 1, padding: "10px 0", borderRadius: "8px", cursor: "pointer",
                                    background: bgMode === opt.value ? "#1a73e8" : "#3c4043",
                                    border: "none", color: "white", fontSize: "12px", fontWeight: 600,
                                    transition: "background 0.2s"
                                }}>
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "20px", justifyContent: "center" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: "32px", height: "32px", background: "#1a73e8", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M17 10.5V7C17 6.44772 16.5523 6 16 6H6C5.44772 6 5 6.44772 5 7V17C5 17.5523 5.44772 18 6 18H16C16.5523 18 17 17.5523 17 17V13.5L21 17.5V6.5L17 10.5Z" />
                                </svg>
                            </div>
                            <span style={{ color: "white", fontSize: "22px", fontWeight: 700 }}>Ready to join?</span>
                        </div>
                        <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
                            Meeting: <span style={{ color: "#8ab4f8", fontFamily: "monospace", letterSpacing: "1px" }}>
                                {meetingId?.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3") || meetingId}
                            </span>
                        </p>
                    </div>

                    {/* Display name */}
                    <div>
                        <label style={{ color: "#9ca3af", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>Your name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && join()}
                            placeholder="Enter your name"
                            autoFocus
                            style={{
                                width: "100%", background: "#3c4043", border: "1px solid #5f6368",
                                borderRadius: "8px", color: "white", padding: "10px 14px",
                                fontSize: "14px", outline: "none", boxSizing: "border-box"
                            }}
                            onFocus={e => e.target.style.borderColor = "#1a73e8"}
                            onBlur={e => e.target.style.borderColor = "#5f6368"}
                        />
                    </div>

                    {/* Device selectors */}
                    {cameras.length > 1 && (
                        <div>
                            <label style={{ color: "#9ca3af", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Camera</label>
                            <select style={{ width: "100%", background: "#3c4043", border: "1px solid #5f6368", borderRadius: "8px", color: "white", padding: "8px 12px", fontSize: "13px", outline: "none" }}>
                                {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                            </select>
                        </div>
                    )}
                    {mics.length > 1 && (
                        <div>
                            <label style={{ color: "#9ca3af", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Microphone</label>
                            <select style={{ width: "100%", background: "#3c4043", border: "1px solid #5f6368", borderRadius: "8px", color: "white", padding: "8px 12px", fontSize: "13px", outline: "none" }}>
                                {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Join button with Advanced Visual Transition Algorithm */}
                    <button 
                        onClick={join} 
                        disabled={isJoining}
                        style={{
                            background: isJoining ? "#3c4043" : "linear-gradient(135deg, #1a73e8, #0d47a1)",
                            border: "none", color: "white", borderRadius: "12px",
                            padding: "14px", fontSize: "16px", fontWeight: 700, 
                            cursor: isJoining ? "wait" : "pointer",
                            boxShadow: isJoining ? "none" : "0 4px 15px rgba(26,115,232,0.4)",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                            position: "relative", overflow: "hidden"
                        }}
                        onMouseEnter={e => !isJoining && (e.currentTarget.style.opacity = "0.9")}
                        onMouseLeave={e => !isJoining && (e.currentTarget.style.opacity = "1")}
                        onMouseDown={e => !isJoining && (e.currentTarget.style.transform = "scale(0.98)")}
                        onMouseUp={e => !isJoining && (e.currentTarget.style.transform = "scale(1)")}
                    >
                        {isJoining ? (
                            <>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
                                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
                                </svg>
                                <span>Establishing secure connection...</span>
                            </>
                        ) : (
                            "Join Meeting"
                        )}
                        
                        {/* CSS for spinner */}
                        <style dangerouslySetInnerHTML={{__html: `
                            @keyframes spin { 100% { transform: rotate(360deg); } }
                        `}} />
                    </button>
                </div>
            </div>
        </div>
    )
}
