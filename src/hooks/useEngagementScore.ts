"use client"

/**
 * useEngagementScore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes a real-time 0–100 "Attention Score" per participant by fusing:
 *
 *   • Gaze direction   (40% weight) — FORWARD = attentive
 *   • Face count       (25% weight) — exactly 1 face = good
 *   • Stress level     (20% weight) — low stress = engaged
 *   • LSTM anomaly     (15% weight) — low anomaly = normal behaviour
 *
 * Research basis (2025/2026):
 *   Multimodal engagement scoring combining visual attention (gaze),
 *   behavioural continuity (LSTM), and physiological stress signals is the
 *   2025/2026 state of the art for online learning platforms and virtual
 *   meeting quality assessment.
 *
 * The score uses an exponential moving average (α = 0.15) to smooth jitter
 * and a sliding 60-second history window for trend analysis.
 */

import { useState, useEffect, useRef } from "react"
import { GazeDirection } from "./useGazeTracking"

// ── Types ─────────────────────────────────────────────────────────────────────
export type EngagementLevel = "Highly Engaged" | "Engaged" | "Distracted" | "Absent"

export interface EngagementPoint {
    timestamp: number
    score: number
}

export interface EngagementResult {
    score: number                   // 0–100 current attention score
    level: EngagementLevel          // human-readable label
    trend: "rising" | "falling" | "stable"
    history: EngagementPoint[]      // last 60 s of data points
    breakdown: {
        gazeScore: number           // 0–100
        faceScore: number           // 0–100
        calmScore: number           // 0–100 (inverse of stress)
        behaviorScore: number       // 0–100 (inverse of LSTM anomaly)
    }
}

export interface UseEngagementScoreOptions {
    enabled: boolean
    gazeDirection: GazeDirection
    faceCount: number
    stressLevel: number     // 0–100 from useStressVoiceDetection
    lstmAnomaly: number     // 0–100 from useLSTMBehavior
}

// ── Config ────────────────────────────────────────────────────────────────────
const GAZE_WEIGHT     = 0.40
const FACE_WEIGHT     = 0.25
const STRESS_WEIGHT   = 0.20
const LSTM_WEIGHT     = 0.15
const EMA_ALPHA       = 0.15        // Smoothing factor
const UPDATE_INTERVAL = 1000        // ms between score updates
const HISTORY_WINDOW  = 60_000      // 60 seconds of history

const GAZE_SCORES: Record<GazeDirection, number> = {
    FORWARD: 100,
    UP:       40,
    DOWN:     25,    // likely reading something below desk
    LEFT:     20,
    RIGHT:    20,    // possible second monitor / phone
    NO_FACE:   0,
}

function classify(score: number): EngagementLevel {
    if (score >= 75) return "Highly Engaged"
    if (score >= 50) return "Engaged"
    if (score >= 25) return "Distracted"
    return "Absent"
}

function detectTrend(history: EngagementPoint[]): "rising" | "falling" | "stable" {
    if (history.length < 6) return "stable"
    const recent = history.slice(-6).map(p => p.score)
    const older  = history.slice(-12, -6).map(p => p.score)
    if (older.length === 0) return "stable"
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg  = older.reduce((a, b) => a + b, 0) / older.length
    const diff = recentAvg - olderAvg
    if (diff > 5) return "rising"
    if (diff < -5) return "falling"
    return "stable"
}

export function useEngagementScore({
    enabled,
    gazeDirection,
    faceCount,
    stressLevel,
    lstmAnomaly,
}: UseEngagementScoreOptions): EngagementResult {
    const smoothedRef = useRef(100)

    const [score, setScore]     = useState(100)
    const [level, setLevel]     = useState<EngagementLevel>("Highly Engaged")
    const [trend, setTrend]     = useState<"rising" | "falling" | "stable">("stable")
    const [history, setHistory] = useState<EngagementPoint[]>([])
    const [breakdown, setBreakdown] = useState({
        gazeScore: 100, faceScore: 100, calmScore: 100, behaviorScore: 100,
    })

    // Keep latest values in ref so the interval always reads fresh data
    const latestRef = useRef({ gazeDirection, faceCount, stressLevel, lstmAnomaly })
    useEffect(() => {
        latestRef.current = { gazeDirection, faceCount, stressLevel, lstmAnomaly }
    }, [gazeDirection, faceCount, stressLevel, lstmAnomaly])

    useEffect(() => {
        if (!enabled) {
            setScore(0)
            setLevel("Absent")
            setTrend("stable")
            setHistory([])
            return
        }

        const interval = setInterval(() => {
            const { gazeDirection, faceCount, stressLevel, lstmAnomaly } = latestRef.current

            // Component scores (all 0–100)
            const gazeScore     = GAZE_SCORES[gazeDirection] ?? 50
            const faceScore     = faceCount === 1 ? 100 : faceCount === 0 ? 0 : 60   // >1 face = suspicious
            const calmScore     = Math.max(0, 100 - stressLevel)                      // invert stress
            const behaviorScore = Math.max(0, 100 - lstmAnomaly)                      // invert LSTM anomaly

            // Weighted sum
            const raw = Math.round(
                gazeScore     * GAZE_WEIGHT   +
                faceScore     * FACE_WEIGHT   +
                calmScore     * STRESS_WEIGHT +
                behaviorScore * LSTM_WEIGHT
            )

            // Exponential moving average for smooth display
            smoothedRef.current = Math.round(
                smoothedRef.current * (1 - EMA_ALPHA) + raw * EMA_ALPHA
            )
            const smoothed = smoothedRef.current

            setScore(smoothed)
            setLevel(classify(smoothed))
            setBreakdown({ gazeScore, faceScore, calmScore, behaviorScore })

            setHistory(prev => {
                const now  = Date.now()
                const next = [...prev, { timestamp: now, score: smoothed }]
                    .filter(p => now - p.timestamp <= HISTORY_WINDOW)
                setTrend(detectTrend(next))
                return next
            })
        }, UPDATE_INTERVAL)

        return () => clearInterval(interval)
    }, [enabled])

    return { score, level, trend, history, breakdown }
}
