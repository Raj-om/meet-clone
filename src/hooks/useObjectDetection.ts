"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { ScamSignal } from "./useScamDetection"

import * as tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-backend-webgl"
import "@tensorflow/tfjs-backend-cpu"
import * as cocoSsd from "@tensorflow-models/coco-ssd"

// Lazy load state
let cocoSsdLoaded = false
let detector: cocoSsd.ObjectDetection | null = null

// Objects that indicate cheating in an exam context
const CHEATING_OBJECTS = new Set([
    "cell phone", "book", "laptop", "remote",
    "keyboard", "mouse", "tablet", "person",
])

// Severity map — how suspicious each detected object is (0-100)
const OBJECT_SEVERITY: Record<string, number> = {
    "cell phone": 90,
    "book": 70,
    "laptop": 65,
    "remote": 50,
    "keyboard": 45,
    "mouse": 40,
    "tablet": 85,
    "person": 95,   // extra person = very high risk
}

export interface DetectedObject {
    label: string
    confidence: number
    bbox: [number, number, number, number]  // [x, y, width, height]
    severity: number
    timestamp: number
}

interface UseObjectDetectionOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
    intervalMs?: number
}

export interface ObjectDetectionResult {
    detectedObjects: DetectedObject[]
    suspiciousObjects: DetectedObject[]
    isLoaded: boolean
    isAnalyzing: boolean
    objectRiskScore: number
}

async function loadDetector() {
    if (detector) return detector
    if (cocoSsdLoaded) {
        while (!detector) await new Promise(r => setTimeout(r, 100))
        return detector
    }
    cocoSsdLoaded = true
    try {
        // Load TF.js with WebGL backend for GPU acceleration
        await tf.setBackend("webgl")
        await tf.ready()
        detector = await cocoSsd.load({ base: "mobilenet_v2" })
    } catch (e) {
        console.warn("[useObjectDetection] Failed to load model:", e)
        cocoSsdLoaded = false
    }
    return detector
}

export function useObjectDetection({
    videoRef,
    enabled,
    updateScore,
    intervalMs = 3000,
}: UseObjectDetectionOptions): ObjectDetectionResult {
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([])
    const [suspiciousObjects, setSuspiciousObjects] = useState<DetectedObject[]>([])
    const [isLoaded, setIsLoaded] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [objectRiskScore, setObjectRiskScore] = useState(0)

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    const analyze = useCallback(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return

        const d = await loadDetector()
        if (!d) return
        setIsLoaded(true)

        setIsAnalyzing(true)
        try {
            const predictions = await d.detect(video)
            const now = Date.now()

            const all: DetectedObject[] = predictions.map(p => ({
                label: p.class,
                confidence: Math.round(p.score * 100),
                bbox: p.bbox as [number, number, number, number],
                severity: OBJECT_SEVERITY[p.class] ?? 20,
                timestamp: now,
            }))

            const suspicious = all.filter(o =>
                CHEATING_OBJECTS.has(o.label) && o.confidence > 50
            )

            setDetectedObjects(all)
            setSuspiciousObjects(suspicious)

            // Compute risk: max severity of any suspicious object detected
            const risk = suspicious.length > 0
                ? Math.min(100, Math.max(...suspicious.map(o => o.severity)))
                : 0

            setObjectRiskScore(risk)

            // Contribute to behavioral signal (replaces old useBehaviorAnalysis)
            updateScore("behavioral", risk)

        } catch (e) {
            console.warn("[useObjectDetection] inference error:", e)
        } finally {
            setIsAnalyzing(false)
        }
    }, [videoRef, updateScore])

    const activeRef = useRef(false)

    useEffect(() => {
        if (!enabled) {
            updateScore("behavioral", 0)
            setDetectedObjects([])
            setSuspiciousObjects([])
            setObjectRiskScore(0)
            activeRef.current = false
            return
        }

        activeRef.current = true

        // Pre-load model on mount
        loadDetector().then(d => { if (d) setIsLoaded(true) })

        const loop = async () => {
            if (!activeRef.current) return
            await analyze()
            if (activeRef.current) {
                intervalRef.current = setTimeout(loop, intervalMs)
            }
        }
        loop()

        return () => {
            activeRef.current = false
            if (intervalRef.current) clearTimeout(intervalRef.current)
        }
    }, [enabled, analyze, intervalMs, updateScore])

    return { detectedObjects, suspiciousObjects, isLoaded, isAnalyzing, objectRiskScore }
}
