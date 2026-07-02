"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Detects the loudest speaker by analysing audio level from each peer connection
 * via RTCPeerConnection.getStats(). Returns the userId of the active speaker.
 */
export const useActiveSpeaker = (
    peersRef: React.RefObject<Record<string, RTCPeerConnection>>,
    localStream: MediaStream | null,
    localUserId: string
) => {
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
    // Local audio level via AnalyserNode
    const localAnalyserRef = useRef<AnalyserNode | null>(null)
    const localCtxRef = useRef<AudioContext | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Set up local audio analyser
    useEffect(() => {
        if (!localStream) return
        const tracks = localStream.getAudioTracks()
        if (tracks.length === 0) return

        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(localStream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        localCtxRef.current = ctx
        localAnalyserRef.current = analyser

        return () => {
            ctx.close()
            localAnalyserRef.current = null
        }
    }, [localStream])

    useEffect(() => {
        const SILENCE_THRESHOLD = 5 // rms below this = silent

        intervalRef.current = setInterval(async () => {
            const levels: Record<string, number> = {}

            // Local level
            if (localAnalyserRef.current) {
                const data = new Uint8Array(localAnalyserRef.current.frequencyBinCount)
                localAnalyserRef.current.getByteFrequencyData(data)
                const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length)
                levels[localUserId] = rms
            }

            // Remote levels via getStats audioLevel
            const peers = peersRef.current
            for (const [peerId, pc] of Object.entries(peers)) {
                try {
                    const stats = await pc.getStats()
                    let maxLevel = 0
                    stats.forEach(report => {
                        if (report.type === "inbound-rtp" && report.kind === "audio") {
                            maxLevel = Math.max(maxLevel, (report.audioLevel || 0) * 100)
                        }
                    })
                    levels[peerId] = maxLevel
                } catch { /* ignore */ }
            }

            // Find loudest
            const loudest = Object.entries(levels)
                .filter(([, v]) => v > SILENCE_THRESHOLD)
                .sort(([, a], [, b]) => b - a)[0]

            setActiveSpeakerId(loudest ? loudest[0] : null)
        }, 1500)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [peersRef, localUserId])

    return activeSpeakerId
}
