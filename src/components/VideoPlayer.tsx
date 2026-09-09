"use client"

import { useEffect, useRef, forwardRef, useState } from "react"
import { SignalQuality, qualityColor } from "@/hooks/useNetworkQuality"

interface VideoPlayerProps {
    stream: MediaStream | null
    muted?: boolean
    label?: string
    isPinned?: boolean
    isLocal?: boolean
    deepfakeLabel?: "Real" | "Suspicious" | "Deepfake Detected" | null
    riskScore?: number
    isActiveSpeaker?: boolean
    networkQuality?: SignalQuality
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
    function VideoPlayer(
        { stream, muted = false, label = "User", isPinned = false, isLocal = false, deepfakeLabel = null, riskScore, isActiveSpeaker = false, networkQuality },
        ref
    ) {
        const internalRef = useRef<HTMLVideoElement>(null)
        const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef
        const [hasVideo, setHasVideo] = useState(false)

        useEffect(() => {
            if (videoRef.current && stream) {
                videoRef.current.srcObject = stream;
                if (!muted) {
                    videoRef.current.volume = 1.0;
                }
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.warn("[VideoPlayer] Autoplay waiting for user gesture:", err);
                    });
                }
            }
        }, [stream, videoRef, muted])

        // Resume playback on user click/tap if browser autoplay policy blocked unmuted remote audio
        useEffect(() => {
            const unlockAudio = () => {
                if (videoRef.current && videoRef.current.paused && stream) {
                    videoRef.current.play().catch(() => {});
                }
            };
            window.addEventListener("click", unlockAudio);
            window.addEventListener("touchstart", unlockAudio);
            return () => {
                window.removeEventListener("click", unlockAudio);
                window.removeEventListener("touchstart", unlockAudio);
            };
        }, [stream, videoRef])

        useEffect(() => {
            const checkTracks = () => {
                if (!stream) {
                    setHasVideo(false)
                    return
                }
                const vTracks = stream.getVideoTracks()
                const isLive = vTracks.length > 0 && vTracks.some(t => t.enabled && t.readyState === "live")
                setHasVideo(isLive)
            }
            checkTracks()
            const iv = setInterval(checkTracks, 800)
            return () => clearInterval(iv)
        }, [stream])

        const badgeColor =
            deepfakeLabel === "Deepfake Detected" ? "#ef4444"
                : deepfakeLabel === "Suspicious" ? "#f59e0b"
                    : "#22c55e"

        const badgeIcon =
            deepfakeLabel === "Deepfake Detected" ? "🤖"
                : deepfakeLabel === "Suspicious" ? "⚠️"
                    : "✅"

        // CRITICAL FIX: Local user looking at their own webcam must NEVER be flagged as high-risk / attacker!
        // Also: "Suspicious" is an informational warning badge; ONLY confirmed "Deepfake Detected" (or riskScore >= 75) is high risk.
        const isHighRisk = !isLocal && (
            (riskScore !== undefined && riskScore >= 75) || 
            deepfakeLabel === "Deepfake Detected"
        )

        const borderColor =
            isHighRisk ? "#ef4444"
                : !isLocal && deepfakeLabel === "Suspicious" ? "#f59e0b"
                    : riskScore && riskScore >= 40 ? "#f59e0b"
                        : "transparent"

        return (
            <div
                className={`video-container ${isPinned ? "pinned" : ""}`}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    borderRadius: "16px",
                    boxSizing: "border-box",
                    backgroundColor: "rgba(10, 10, 15, 0.8)",
                    backdropFilter: "blur(12px)",
                    boxShadow: isActiveSpeaker ? "0 0 0 2px #8b5cf6, 0 0 35px rgba(139,92,246,0.5)" : "inset 0 0 0 1px rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.6)",
                    border: isActiveSpeaker ? "2px solid #a78bfa" : `2px solid ${borderColor}`,
                    transition: "all 0.4s cubic-bezier(0.2, 0, 0, 1)",
                }}
            >
                {/* Video element remains active in DOM so audio is NEVER muted/suspended by display:none */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={muted}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: muted ? "scaleX(-1)" : "none",
                        borderRadius: "10px",
                        filter: isHighRisk ? "contrast(1.2) saturate(1.5) sepia(0.3) hue-rotate(-20deg)" : "none",
                        transition: "opacity 0.3s ease, filter 0.3s ease",
                        opacity: hasVideo ? 1 : 0,
                        zIndex: hasVideo ? 1 : 0,
                    }}
                />

                {/* Intentional Camera-Off / Connecting State (visible when video track is not live) */}
                {!hasVideo && (
                    <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        background: "radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0d0e15 70%, #06070a 100%)",
                        borderRadius: "14px",
                        zIndex: 1,
                    }}>
                        <div style={{
                            width: "64px", height: "64px", borderRadius: "50%",
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "26px", fontWeight: "700", color: "white",
                            boxShadow: "0 8px 24px rgba(99,102,241,0.35), inset 0 2px 0 rgba(255,255,255,0.2)"
                        }}>
                            {(label.charAt(0) || "U").toUpperCase()}
                        </div>
                        <div style={{
                            fontSize: "11px", color: "rgba(255,255,255,0.6)",
                            background: "rgba(255,255,255,0.06)", padding: "3px 10px",
                            borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)",
                            display: "flex", alignItems: "center", gap: "6px"
                        }}>
                            <span>📷</span>
                            {stream ? "Camera Off" : "Connecting video..."}
                        </div>
                    </div>
                )}

                {/* Glaring Warning Overlay for High Risk / Fakes */}
                {isHighRisk && (
                    <div style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: "rgba(239, 68, 68, 0.2)",
                        border: "4px solid rgba(239, 68, 68, 0.8)",
                        boxShadow: "inset 0 0 40px rgba(239, 68, 68, 0.6)",
                        pointerEvents: "none",
                        zIndex: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "glitchOverlay 0.5s ease infinite alternate",
                    }}>
                        <div style={{
                            backgroundColor: "rgba(0, 0, 0, 0.85)",
                            color: "#ef4444",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            fontWeight: 900,
                            letterSpacing: "1px",
                            fontSize: "1.2rem",
                            textAlign: "center",
                            border: "2px solid #ef4444",
                            textTransform: "uppercase",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                            animation: "pulseWarning 1s infinite"
                        }}>
                            🚨 FAKE FEED DETECTED 🚨
                            <div style={{ fontSize: "0.75rem", color: "white", marginTop: "4px", fontWeight: "normal" }}>
                                YOU ARE NOT SAFE. DO NOT SHARE INFO.
                            </div>
                        </div>
                    </div>
                )}

                {/* Top right badges */}
                <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                    {deepfakeLabel && (
                        <div style={{
                            background: badgeColor,
                            color: deepfakeLabel === "Real" ? "#000" : "white",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: 800,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: `0 4px 15px ${badgeColor}60`,
                            border: `1px solid rgba(255,255,255,0.2)`
                        }}>
                            {badgeIcon} {deepfakeLabel}
                        </div>
                    )}
                </div>

                {/* Bottom left info overlay */}
                <div style={{
                    position: "absolute",
                    bottom: "12px",
                    left: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(12px)",
                    padding: "6px 12px",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: 600,
                    letterSpacing: "0.3px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
                }}>
                    {networkQuality && (
                        <span
                            className="net-quality-dot"
                            style={{ background: qualityColor(networkQuality), width: "8px", height: "8px", borderRadius: "50%" }}
                            title={`Network: ${networkQuality}`}
                        />
                    )}
                    {label}
                    {isActiveSpeaker && <span style={{ fontSize: "12px" }}>🎤</span>}
                </div>

                {/* Deepfake badge */}
                {deepfakeLabel && (
                    <div style={{
                        position: "absolute", top: "10px", right: "10px",
                        background: `${badgeColor}22`,
                        border: `1px solid ${badgeColor}90`,
                        borderRadius: "99px",
                        padding: "3px 10px",
                        fontSize: "11px", fontWeight: "700",
                        color: badgeColor,
                        display: "flex", alignItems: "center", gap: "4px",
                        backdropFilter: "blur(6px)",
                        animation: deepfakeLabel === "Deepfake Detected" ? "pulseRing 1.5s infinite" : "none",
                    }}>
                        {badgeIcon} {deepfakeLabel}
                    </div>
                )}

                <style>{`
                    .video-container { transition: all 0.3s ease; }
                    .pinned { grid-column: 1 / -1; height: 60vh; }
                    @keyframes pulseRing {
                        0%   { box-shadow: 0 0 0 0px rgba(239,68,68,0.5); }
                        70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
                        100% { box-shadow: 0 0 0 0px rgba(239,68,68,0); }
                    }
                    @keyframes pulseWarning {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.9; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes glitchOverlay {
                        0% { background-color: rgba(239, 68, 68, 0.15); }
                        100% { background-color: rgba(239, 68, 68, 0.25); }
                    }
                `}</style>
            </div>
        )
    }
)

export default VideoPlayer
