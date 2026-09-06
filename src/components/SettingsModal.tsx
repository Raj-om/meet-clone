"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
    onClose: () => void
    onDevicesSelected: (videoId: string, audioId: string) => void
}

export default function SettingsModal({ onClose, onDevicesSelected }: Props) {
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
    const [mics, setMics] = useState<MediaDeviceInfo[]>([])
    const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([])
    const [selectedCamera, setSelectedCamera] = useState("")
    const [selectedMic, setSelectedMic] = useState("")
    const [selectedSpeaker, setSelectedSpeaker] = useState("")
    const [audioLevel, setAudioLevel] = useState(0)
    const [activeTab, setActiveTab] = useState<"audio" | "video" | "general">("audio")
    const previewRef = useRef<HTMLVideoElement>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const animRef = useRef<number>(0)

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            setCameras(devices.filter(d => d.kind === "videoinput"))
            setMics(devices.filter(d => d.kind === "audioinput"))
            setSpeakers(devices.filter(d => d.kind === "audiooutput"))
            const cam = devices.find(d => d.kind === "videoinput")
            const mic = devices.find(d => d.kind === "audioinput")
            const spk = devices.find(d => d.kind === "audiooutput")
            if (cam) setSelectedCamera(cam.deviceId)
            if (mic) setSelectedMic(mic.deviceId)
            if (spk) setSelectedSpeaker(spk.deviceId)
        })
    }, [])

    // Camera preview
    useEffect(() => {
        if (activeTab !== "video") return
        let stream: MediaStream
        navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: selectedCamera || undefined,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 60, min: 30 }
                }
            })
            .then(s => {
                stream = s
                if (previewRef.current) {
                    previewRef.current.srcObject = s
                    previewRef.current.play().catch(e => console.warn("Settings preview interrupted:", e.message))
                }
            }).catch(() => { })
        return () => { stream?.getTracks().forEach(t => t.stop()) }
    }, [activeTab, selectedCamera])

    // Mic level meter
    useEffect(() => {
        if (activeTab !== "audio" || !selectedMic) return

        let stream: MediaStream
        let ctx: AudioContext
        navigator.mediaDevices
            .getUserMedia({
                audio: {
                    deviceId: selectedMic,
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 48000,
                    channelCount: 2
                }
            })
            .then(s => {
                stream = s
                ctx = new AudioContext()
                const source = ctx.createMediaStreamSource(s)
                const analyser = ctx.createAnalyser()
                analyser.fftSize = 256
                source.connect(analyser)
                analyserRef.current = analyser
                const data = new Uint8Array(analyser.frequencyBinCount)
                
                let lastTime = 0
                const tick = (time: number) => {
                    // throttle to ~10fps to avoid excessive re-renders
                    if (time - lastTime > 100) {
                        analyser.getByteFrequencyData(data)
                        const avg = data.reduce((a, b) => a + b, 0) / data.length
                        setAudioLevel(Math.round((avg / 255) * 100))
                        lastTime = time
                    }
                    animRef.current = requestAnimationFrame(tick)
                }
                animRef.current = requestAnimationFrame(tick)
            }).catch(() => { })
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current)
            stream?.getTracks().forEach(t => t.stop())
            ctx?.close()
        }
    }, [activeTab, selectedMic])

    const tabs = [
        { id: "audio" as const, label: "🎤 Audio" },
        { id: "video" as const, label: "📷 Video" },
        { id: "general" as const, label: "⚙️ General" },
    ]

    const inputStyle = {
        width: "100%", background: "#3c4043", border: "1px solid #5f6368",
        borderRadius: "8px", color: "white", padding: "8px 12px",
        fontSize: "13px", outline: "none"
    }

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)"
        }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{
                background: "#292b2f", borderRadius: "16px", width: "480px", maxHeight: "80vh",
                display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                border: "1px solid #3c4043", overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #3c4043", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ color: "white", margin: 0, fontSize: "16px" }}>⚙️ Settings</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "20px", cursor: "pointer" }}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid #3c4043" }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                            flex: 1, padding: "10px", background: "none", border: "none",
                            borderBottom: activeTab === t.id ? "2px solid #1a73e8" : "2px solid transparent",
                            color: activeTab === t.id ? "white" : "#9ca3af", cursor: "pointer",
                            fontSize: "13px", fontWeight: activeTab === t.id ? 600 : 400, transition: "all 0.2s"
                        }}>{t.label}</button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                    {activeTab === "audio" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "6px" }}>MICROPHONE</label>
                                <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)} style={inputStyle as React.CSSProperties}>
                                    {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "6px" }}>INPUT LEVEL</label>
                                <div style={{ background: "#3c4043", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", width: `${audioLevel}%`,
                                        background: audioLevel > 70 ? "#ef4444" : audioLevel > 40 ? "#f59e0b" : "#22c55e",
                                        transition: "width 0.1s, background 0.2s"
                                    }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "6px" }}>SPEAKER / OUTPUT</label>
                                <select value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)} style={inputStyle as React.CSSProperties}>
                                    {speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Speaker"}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === "video" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "6px" }}>CAMERA</label>
                                <select value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)} style={inputStyle as React.CSSProperties}>
                                    {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "6px" }}>PREVIEW</label>
                                <video ref={previewRef} muted autoPlay playsInline style={{
                                    width: "100%", borderRadius: "8px", background: "#1a1a1a",
                                    aspectRatio: "16/9", objectFit: "cover", transform: "scaleX(-1)"
                                }} />
                            </div>
                        </div>
                    )}

                    {activeTab === "general" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#9ca3af", fontSize: "13px" }}>
                            <div style={{ background: "#3c4043", borderRadius: "8px", padding: "12px" }}>
                                <div style={{ color: "white", fontWeight: 600, marginBottom: "4px" }}>Keyboard Shortcuts</div>
                                {[["M", "Mute / Unmute"], ["V", "Toggle camera"], ["C", "Open chat"], ["S", "Screen share"], ["R", "Reactions"], ["Escape", "Close panels"]].map(([key, label]) => (
                                    <div key={key} style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                                        <span>{label}</span>
                                        <kbd style={{ background: "#5f6368", color: "white", borderRadius: "4px", padding: "2px 8px", fontSize: "12px" }}>{key}</kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid #3c4043", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button onClick={onClose} style={{ background: "#3c4043", border: "none", color: "white", borderRadius: "8px", padding: "8px 20px", cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => { onDevicesSelected(selectedCamera, selectedMic); onClose() }} style={{
                        background: "#1a73e8", border: "none", color: "white", borderRadius: "8px", padding: "8px 20px", cursor: "pointer", fontWeight: 600
                    }}>Apply</button>
                </div>
            </div>
        </div>
    )
}
