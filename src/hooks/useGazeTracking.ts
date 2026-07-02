"use client"

import { useState, useEffect, useRef } from "react"
import { MediaPipeFaceResult } from "./useMediaPipeFace"

export type GazeDirection = "FORWARD" | "LEFT" | "RIGHT" | "UP" | "DOWN" | "NO_FACE"

export interface GazeEvent {
    timestamp: number
    direction: GazeDirection
    duration: number  // ms looking away
}

interface UseGazeTrackingOptions {
    faceResult: MediaPipeFaceResult
    /** Bounding rect of the exam panel div (for "reading" vs "looking away" detection) */
    examPanelRef?: React.RefObject<HTMLDivElement | null>
    enabled: boolean
    onGazeAway?: (direction: GazeDirection, durationMs: number) => void
    awayThresholdMs?: number  // ms before flagging a look-away (default 2000)
}

export interface GazeTrackingResult {
    direction: GazeDirection
    isLookingAway: boolean
    awayDurationMs: number
    gazeEvents: GazeEvent[]
    /** 0-100: how often student is NOT looking at screen */
    gazeAttentionScore: number
}

const GAZE_THRESHOLDS = {
    leftRight: 0.35,   // gazeX threshold for L/R detection
    upDown: 0.30,      // gazeY threshold for U/D detection
    yaw: 20,           // head yaw degrees before flagging turn
    pitch: 15,         // head pitch degrees before flagging tilt
}

export function useGazeTracking({
    faceResult,
    enabled,
    onGazeAway,
    awayThresholdMs = 2000,
}: UseGazeTrackingOptions): GazeTrackingResult {
    const [direction, setDirection] = useState<GazeDirection>("FORWARD")
    const [isLookingAway, setIsLookingAway] = useState(false)
    const [awayDurationMs, setAwayDurationMs] = useState(0)
    const [gazeEvents, setGazeEvents] = useState<GazeEvent[]>([])
    const [gazeAttentionScore, setGazeAttentionScore] = useState(0)

    const awayStartRef = useRef<number | null>(null)
    const currentDirRef = useRef<GazeDirection>("FORWARD")
    const awayCountRef = useRef(0)
    const totalSamplesRef = useRef(0)
    const lastScoreUpdateRef = useRef(0)

    useEffect(() => {
        if (!enabled) {
            setDirection("FORWARD")
            setIsLookingAway(false)
            setAwayDurationMs(0)
            return
        }

        const { gazeX, gazeY, headYaw, headPitch, faceDetected } = faceResult

        totalSamplesRef.current++

        // Determine gaze direction combining iris gaze + head pose
        let newDir: GazeDirection = "FORWARD"

        if (!faceDetected) {
            newDir = "NO_FACE"
        } else {
            // Head pose takes priority for large movements
            if (Math.abs(headYaw) > GAZE_THRESHOLDS.yaw) {
                newDir = headYaw > 0 ? "LEFT" : "RIGHT"
            } else if (headPitch > GAZE_THRESHOLDS.pitch) {
                newDir = "DOWN"  // Looking down at phone/paper under desk
            } else if (headPitch < -GAZE_THRESHOLDS.pitch) {
                newDir = "UP"
            }
            // Fine-grained iris gaze for subtle shifts
            else if (Math.abs(gazeX) > GAZE_THRESHOLDS.leftRight) {
                newDir = gazeX > 0 ? "RIGHT" : "LEFT"  // Second monitor
            } else if (Math.abs(gazeY) > GAZE_THRESHOLDS.upDown) {
                newDir = gazeY > 0 ? "DOWN" : "UP"
            }
        }

        setDirection(prev => prev === newDir ? prev : newDir)
        currentDirRef.current = newDir

        const lookingAway = newDir !== "FORWARD"

        if (lookingAway) {
            awayCountRef.current++
            if (!awayStartRef.current) {
                awayStartRef.current = Date.now()
            }
            const duration = Date.now() - awayStartRef.current
            setAwayDurationMs(duration)
            setIsLookingAway(prev => prev ? prev : true)

            // Fire callback after threshold
            if (duration >= awayThresholdMs && onGazeAway) {
                onGazeAway(newDir, duration)
            }
        } else {
            if (awayStartRef.current) {
                // Record the gaze event
                const duration = Date.now() - awayStartRef.current
                if (duration > 500) {  // Ignore very brief glances
                    const event: GazeEvent = {
                        timestamp: awayStartRef.current,
                        direction: currentDirRef.current,
                        duration,
                    }
                    setGazeEvents(prev => [event, ...prev].slice(0, 50))
                }
                awayStartRef.current = null
            }
            setIsLookingAway(false)
            setAwayDurationMs(0)
        }

        // Attention score: % of time looking away
        const awayPct = totalSamplesRef.current > 0
            ? Math.round((awayCountRef.current / totalSamplesRef.current) * 100)
            : 0
            
        // Throttle React state updates to avoid Maximum Update Depth Exceeded
        const now = Date.now()
        if (now - (lastScoreUpdateRef.current || 0) > 1000) {
            setGazeAttentionScore(awayPct)
            lastScoreUpdateRef.current = now
        }

    }, [
        faceResult.faceDetected, 
        faceResult.headYaw, 
        faceResult.headPitch, 
        faceResult.gazeX, 
        faceResult.gazeY,
        enabled, 
        onGazeAway, 
        awayThresholdMs
    ])

    return { direction, isLookingAway, awayDurationMs, gazeEvents, gazeAttentionScore }
}
