"use client"

import { useEffect, useRef, useState } from "react"
import { DecisionTree, RandomForest } from "@/utils/RandomForest"

export type NetworkFeatures = {
    rtt: number
    jitter: number
    packetLoss: number
    recentDrops: number
}

// Predicts the optimal bitrate (in bits per second)
// Max WebRTC bitrate is usually around 2.5 Mbps (2500000) for standard HD
const PRETRAINED_BITRATE_TREES = [
    // Tree 1: High packet loss drastically cuts bitrate
    {
        type: "split", feature: "packetLoss", threshold: 5,
        left: { // Loss <= 5% -> check RTT
            type: "split", feature: "rtt", threshold: 150,
            left: { type: "leaf", value: 2000000 }, // Good network: 2 Mbps
            right: { type: "leaf", value: 1200000 } // Med network: 1.2 Mbps
        },
        right: { // Loss > 5% -> drastic cut
            type: "split", feature: "recentDrops", threshold: 2,
            left: { type: "leaf", value: 600000 }, // 600 kbps
            right: { type: "leaf", value: 250000 }  // 250 kbps
        }
    },
    // Tree 2: Jitter focus
    {
        type: "split", feature: "jitter", threshold: 30,
        left: {
            type: "split", feature: "rtt", threshold: 100,
            left: { type: "leaf", value: 2500000 },
            right: { type: "leaf", value: 1500000 }
        },
        right: {
            type: "split", feature: "packetLoss", threshold: 10,
            left: { type: "leaf", value: 800000 },
            right: { type: "leaf", value: 150000 } // terrible network
        }
    },
    // Tree 3: Recent drops are leading indicators of congestion
    {
        type: "split", feature: "recentDrops", threshold: 1,
        left: {
            type: "split", feature: "packetLoss", threshold: 2,
            left: { type: "leaf", value: 2200000 },
            right: { type: "leaf", value: 1800000 }
        },
        right: {
            type: "split", feature: "jitter", threshold: 50,
            left: { type: "leaf", value: 900000 },
            right: { type: "leaf", value: 400000 }
        }
    }
]

const aiBitrateForest = new RandomForest(
    PRETRAINED_BITRATE_TREES.map(root => new DecisionTree(root as any))
)

export function useAIBitrateOptimizer(
    peersRef: React.RefObject<Record<string, RTCPeerConnection>>,
    enabled: boolean
) {
    const [optimalBitrate, setOptimalBitrate] = useState<number>(2000000)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }

        let previousLoss = 0

        const optimize = async () => {
            const peers = peersRef.current
            if (!peers) return

            let worstRtt = 0
            let worstJitter = 0
            let totalLoss = 0
            let totalPackets = 0

            for (const pc of Object.values(peers)) {
                try {
                    const stats = await pc.getStats()
                    stats.forEach(report => {
                        if (report.type === "inbound-rtp" && report.kind === "video") {
                            worstJitter = Math.max(worstJitter, (report.jitter || 0) * 1000)
                            totalLoss += report.packetsLost || 0
                            totalPackets += report.packetsReceived || 0
                        }
                        if (report.type === "remote-inbound-rtp") {
                            worstRtt = Math.max(worstRtt, (report.roundTripTime || 0) * 1000)
                        }
                    })
                } catch { /* ignore closed PCs */ }
            }

            const packetLossPercent = totalPackets > 0 ? (totalLoss / (totalLoss + totalPackets)) * 100 : 0
            const recentDrops = totalLoss - previousLoss
            previousLoss = totalLoss

            // 1. ML Prediction: Feed network heuristics into Random Forest
            const features: NetworkFeatures = {
                rtt: worstRtt,
                jitter: worstJitter,
                packetLoss: packetLossPercent,
                recentDrops: Math.max(0, recentDrops)
            }

            // TS hack because RandomForest typing currently expects Scam features.  
            // Since it just does a key lookup, passing NetworkFeatures works at runtime.
            const predictedBitrate = aiBitrateForest.predict(features as any)
            setOptimalBitrate(Math.round(predictedBitrate))

            // 2. Action: Apply the ML predicted maxBitrate to the WebRTC Senders
            for (const pc of Object.values(peers)) {
                const senders = pc.getSenders()
                for (const sender of senders) {
                    if (sender.track?.kind === "video") {
                        const params = sender.getParameters()
                        if (!params.encodings) params.encodings = [{}]
                        // Set bandwidth limit
                        params.encodings[0].maxBitrate = predictedBitrate

                        // We no longer manually scale resolution down here.
                        // We rely on WebRTC's degradationPreference = 'maintain-framerate'
                        // which automatically lowers resolution gracefully when hitting maxBitrate.
                        params.encodings[0].scaleResolutionDownBy = 1.0
                        sender.setParameters(params).catch(() => { })
                    }
                }
            }
        }

        intervalRef.current = setInterval(optimize, 2000)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            // Cleanup: remove restrictions when disabled
            const peers = peersRef.current
            if (peers) {
                for (const pc of Object.values(peers)) {
                    pc.getSenders().forEach(sender => {
                        if (sender.track?.kind === "video") {
                            const params = sender.getParameters()
                            if (params.encodings && params.encodings[0]) {
                                delete params.encodings[0].maxBitrate
                                params.encodings[0].scaleResolutionDownBy = 1.0
                                sender.setParameters(params).catch(() => { })
                            }
                        }
                    })
                }
            }
        }
    }, [peersRef, enabled])

    return { optimalBitrate }
}
