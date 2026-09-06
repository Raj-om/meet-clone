"use client"

/**
 * useArenaNetwork — React hook integrating the ARENA algorithm into the app.
 *
 * This hook:
 * 1. Samples WebRTC stats every 2 seconds
 * 2. Reads facial/engagement context from sibling hooks
 * 3. Runs the ARENA engine to compute per-peer bitrate decisions
 * 4. Applies those decisions directly to RTCPeerConnection sender parameters
 * 5. Returns the current ARENA state for UI display
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { arenaEngine, ArenaContextSignal, ArenaNetworkSample, ArenaState } from "@/utils/ArenaAlgorithm"

interface UseArenaNetworkOptions {
    peersRef: React.RefObject<Record<string, RTCPeerConnection>>
    enabled: boolean
    /** Per-peer context: facial blendshapes + engagement scores */
    contextSignals: ArenaContextSignal[]
    /** Set of peer IDs that are hosts/teachers (they get quality premium) */
    hostPeerIds?: Set<string>
}

const SAMPLE_INTERVAL_MS = 2000  // Run ARENA every 2 seconds

export function useArenaNetwork({
    peersRef,
    enabled,
    contextSignals,
    hostPeerIds = new Set()
}: UseArenaNetworkOptions) {
    const [arenaState, setArenaState] = useState<ArenaState | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const contextRef = useRef(contextSignals)

    // Keep context ref fresh without re-running the effect
    useEffect(() => {
        contextRef.current = contextSignals
    }, [contextSignals])

    const runArena = useCallback(async () => {
        const peers = peersRef.current
        if (!peers || Object.keys(peers).length === 0) return

        // ── Step 1: Collect WebRTC stats ─────────────────────────────────────
        let worstRtt = 0
        let worstJitter = 0
        let totalLost = 0
        let totalReceived = 0

        for (const pc of Object.values(peers)) {
            try {
                const stats = await pc.getStats()
                stats.forEach(report => {
                    if (report.type === "inbound-rtp" && report.kind === "video") {
                        worstJitter = Math.max(worstJitter, (report.jitter || 0) * 1000)
                        totalLost += report.packetsLost || 0
                        totalReceived += report.packetsReceived || 0
                    }
                    if (report.type === "remote-inbound-rtp") {
                        worstRtt = Math.max(worstRtt, (report.roundTripTime || 0) * 1000)
                    }
                })
            } catch { /* ignore closed PCs */ }
        }

        const packetLoss = totalReceived > 0
            ? (totalLost / (totalLost + totalReceived)) * 100
            : 0

        const sample: ArenaNetworkSample = {
            rtt: worstRtt,
            jitter: worstJitter,
            packetLoss,
            timestamp: Date.now()
        }

        // ── Step 2: Run ARENA Engine ──────────────────────────────────────────
        const state = arenaEngine.decide(
            sample,
            contextRef.current,
            hostPeerIds
        )

        setArenaState(state)

        // ── Step 3: Apply per-peer bitrate decisions to WebRTC senders ───────
        for (const decision of state.decisions) {
            const pc = peers[decision.peerId]
            if (!pc) continue

            const senders = pc.getSenders()
            for (const sender of senders) {
                if (sender.track?.kind === "video") {
                    try {
                        const params = sender.getParameters()
                        if (!params.encodings) params.encodings = [{}]
                        params.encodings[0].maxBitrate = decision.targetBitrate
                        // Let WebRTC auto-scale resolution when budget is tight
                        params.encodings[0].scaleResolutionDownBy = 1.0
                        await sender.setParameters(params)
                    } catch { /* sender might be closed */ }
                }
            }
        }

        // If ARENA detects high congestion probability, also cap audio quality
        if (state.globalCongestionProb > 0.7) {
            for (const pc of Object.values(peers)) {
                for (const sender of pc.getSenders()) {
                    if (sender.track?.kind === "audio") {
                        try {
                            const params = sender.getParameters()
                            if (!params.encodings) params.encodings = [{}]
                            params.encodings[0].maxBitrate = 48_000  // 48kbps opus
                            await sender.setParameters(params)
                        } catch { /* ignore */ }
                    }
                }
            }
        }

    }, [peersRef, hostPeerIds])

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            arenaEngine.reset()
            setArenaState(null)
            return
        }

        intervalRef.current = setInterval(runArena, SAMPLE_INTERVAL_MS)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [enabled, runArena])

    return {
        arenaState,
        congestionProb: arenaState?.globalCongestionProb ?? 0,
        totalBitrate: arenaState?.totalAllocatedBitrate ?? 0,
        isArenaActive: enabled && arenaState !== null,
        algorithmVersion: arenaEngine.getVersion()
    }
}
