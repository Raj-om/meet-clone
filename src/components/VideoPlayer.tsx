"use client"

import { useEffect, useRef, forwardRef } from "react"
import { SignalQuality, qualityColor } from "@/hooks/useNetworkQuality"

interface VideoPlayerProps {
    stream: MediaStream | null
    muted?: boolean
    label?: string
    isPinned?: boolean
    deepfakeLabel?: "Real" | "Suspicious" | "Deepfake Detected" | null
    riskScore?: number
    isActiveSpeaker?: boolean
    networkQuality?: SignalQuality
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
    function VideoPlayer(
        { stream, muted = false, label = "User", isPinned = false, deepfakeLabel = null, riskScore, isActiveSpeaker = false, networkQuality },
        ref
    ) {
        const internalRef = useRef<HTMLVideoElement>(null)
        const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef

        useEffect(() => {
            if (videoRef.current && stream) {
                videoRef.current.srcObject = stream
            }
        }, [stream, videoRef])

        const badgeColor =
            deepfakeLabel === "Deepfake Detected" ? "#ef4444"
                : deepfakeLabel === "Suspicious" ? "#f59e0b"
                    : "#22c55e"

        const badgeIcon =
            deepfakeLabel === "Deepfake Detected" ? "🤖"
                : deepfakeLabel === "Suspicious" ? "⚠️"
                    : "✅"

        const isHighRisk = (riskScore && riskScore >= 70) || deepfakeLabel === "Deepfake Detected" || deepfakeLabel === "Suspicious"

        const borderColor =
            isHighRisk ? "#ef4444"
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
                    borderRadius: "12px",
                    backgroundColor: "#303134",
                    boxShadow: isActiveSpeaker ? "0 0 0 3px #1a73e8, 0 0 20px rgba(26,115,232,0.5)" : "var(--shadow-md)",
                    border: isActiveSpeaker ? "2px solid #1a73e8" : `2px solid ${borderColor}`,
                    transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                }}
            >
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={muted}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: muted ? "scaleX(-1)" : "none",
                        borderRadius: "10px",
                        filter: isHighRisk ? "contrast(1.2) saturate(1.5) sepia(0.3) hue-rotate(-20deg)" : "none",
                        transition: "filter 0.3s ease",
                    }}
                />

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

                {/* Participant label + network quality */}
                <div style={{
                    position: "absolute", bottom: "12px", left: "12px",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    padding: "4px 8px", borderRadius: "4px",
                    color: "white", fontSize: "0.85rem", fontWeight: 500,
                    display: "flex", alignItems: "center", gap: "6px"
                }}>
                    {networkQuality && (
                        <span
                            className="net-quality-dot"
                            style={{ background: qualityColor(networkQuality) }}
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
