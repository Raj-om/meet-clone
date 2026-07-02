"use client"

import { useEffect, useRef, useState } from "react"

export type SignalQuality = "good" | "medium" | "poor" | "unknown"

interface PeerQuality {
    jitter: number
    packetLoss: number
    rtt: number
    quality: SignalQuality
}

/** Returns a map of peerId → network quality, sampled every 3 seconds */
export const useNetworkQuality = (
    peersRef: React.RefObject<Record<string, RTCPeerConnection>>
) => {
    const [qualities, setQualities] = useState<Record<string, PeerQuality>>({})
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        const sample = async () => {
            const peers = peersRef.current
            if (!peers) return

            const result: Record<string, PeerQuality> = {}

            for (const [id, pc] of Object.entries(peers)) {
                try {
                    const stats = await pc.getStats()
                    let jitter = 0, totalLost = 0, totalReceived = 0, rtt = 0

                    stats.forEach(report => {
                        if (report.type === "inbound-rtp" && report.kind === "video") {
                            jitter = Math.max(jitter, (report.jitter || 0) * 1000) // convert to ms
                            totalLost += report.packetsLost || 0
                            totalReceived += report.packetsReceived || 0
                        }
                        if (report.type === "remote-inbound-rtp") {
                            rtt = Math.max(rtt, (report.roundTripTime || 0) * 1000)
                        }
                    })

                    const packetLoss = totalReceived > 0
                        ? Math.round((totalLost / (totalLost + totalReceived)) * 100)
                        : 0

                    let quality: SignalQuality = "good"
                    if (packetLoss > 10 || rtt > 300 || jitter > 50) quality = "poor"
                    else if (packetLoss > 3 || rtt > 150 || jitter > 20) quality = "medium"

                    result[id] = { jitter, packetLoss, rtt, quality }
                } catch { /* pc might be closed */ }
            }

            setQualities(result)
        }

        intervalRef.current = setInterval(sample, 3000)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [peersRef])

    return qualities
}

/** Returns a coloured dot indicator element based on quality */
export const qualityColor = (q?: SignalQuality) => {
    if (!q || q === "unknown") return "#9ca3af"
    if (q === "good") return "#22c55e"
    if (q === "medium") return "#f59e0b"
    return "#ef4444"
}
