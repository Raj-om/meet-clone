"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { CognitiveGapAlgorithm } from "@/utils/CognitiveGapAlgorithm"
import { MediaPipeFaceResult } from "@/hooks/useMediaPipeFace"

export interface CognitiveGapState {
    measuredLoad: number
    cognitiveGap: number
    aiCopilotDetected: boolean
    confidence: number
    explanation: string
}

interface UseCognitiveGapOptions {
    faceResult: MediaPipeFaceResult | null
    expectedComplexity: number // 0.0 to 1.0 (how hard the current question is)
    enabled: boolean
}

export function useCognitiveGap({ faceResult, expectedComplexity, enabled }: UseCognitiveGapOptions) {
    // Instantiate the core engine once
    const engine = useMemo(() => new CognitiveGapAlgorithm(), [])
    
    const [gapState, setGapState] = useState<CognitiveGapState | null>(null)
    const lastUpdate = useRef<number>(0)

    useEffect(() => {
        if (!enabled || !faceResult || !faceResult.isModelLoaded || !faceResult.faceDetected) {
            return
        }

        const now = Date.now()
        // Throttle updates to ~10fps
        if (now - lastUpdate.current < 100) return
        lastUpdate.current = now

        // 1. Observe telemetry
        // We use gazeX/gazeY for variance, and blink blendshapes to detect blinks
        const isBlinking = faceResult.blendshapes.eyeBlinkLeft > 0.4 || faceResult.blendshapes.eyeBlinkRight > 0.4
        
        engine.observe(
            { yaw: faceResult.gazeX, pitch: faceResult.gazeY, blink: isBlinking },
            { x: faceResult.headYaw, y: faceResult.headPitch, z: faceResult.headPoseVariance }
        )

        // 2. Evaluate Gap
        const result = engine.evaluateGap(expectedComplexity)
        setGapState(result)

    }, [faceResult, expectedComplexity, enabled, engine])

    return { gapState }
}
