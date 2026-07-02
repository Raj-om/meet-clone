"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { ScamSignal } from "./useScamDetection"

// ── Config ────────────────────────────────────────────────────────────────────
const DIRE_SERVER = "http://localhost:5001"
const SAMPLE_INTERVAL = 6000    // Send a frame every 6 seconds
const FRAME_QUALITY = 0.75    // JPEG quality for frame encoding
const FRAME_SIZE = 224     // Resize frame before sending

export type DireLabel =
    | "Likely Real"
    | "Suspicious"
    | "AI Generated"
    | "Server Offline"

interface UseDireDetectionOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
}

interface DireResult {
    label: DireLabel
    score: number           // 0-100
    mode: string            // "DIRE Model + DCT" or "DCT Heuristic"
    dctScore: number
    colorScore: number
    direScore: number | null
    serverOnline: boolean
    isAnalyzing: boolean
}

/**
 * useDireDetection
 *
 * Sends video frames to the local DIRE Flask server (localhost:5001) for
 * AI-generated content detection. The server uses:
 *
 * - DCT frequency spectrum analysis (detects diffusion model artifacts)
 * - Color statistics fingerprinting (GAN/diffusion color distributions)
 * - Optional DIRE ResNet-50 model (if weights placed in deepfake_server/models/)
 *
 * Falls back gracefully if the server is offline (no hard errors).
 */
export function useDireDetection({
    videoRef,
    enabled,
    updateScore,
}: UseDireDetectionOptions): DireResult {
    const [label, setLabel] = useState<DireLabel>("Likely Real")
    const [score, setScore] = useState(0)
    const [mode, setMode] = useState("DCT Heuristic")
    const [dctScore, setDctScore] = useState(0)
    const [colorScore, setColorScore] = useState(0)
    const [direScore, setDireScore] = useState<number | null>(null)
    const [serverOnline, setServerOnline] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const onlineCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── Check server health ───────────────────────────────────────────────────
    const checkServer = useCallback(async () => {
        try {
            const res = await fetch(`${DIRE_SERVER}/health`, {
                signal: AbortSignal.timeout(2000)
            })
            if (res.ok) {
                const data = await res.json()
                setServerOnline(true)
                setMode(data.mode || "DCT Heuristic")
                return true
            }
        } catch {
            // Server offline
        }
        setServerOnline(false)
        return false
    }, [])

    // ── Capture frame and send to server ──────────────────────────────────────
    const sendFrame = useCallback(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return
        if (!serverOnline) return

        if (!canvasRef.current) canvasRef.current = document.createElement("canvas")
        const canvas = canvasRef.current
        canvas.width = FRAME_SIZE
        canvas.height = FRAME_SIZE
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        ctx.drawImage(video, 0, 0, FRAME_SIZE, FRAME_SIZE)
        const frameB64 = canvas.toDataURL("image/jpeg", FRAME_QUALITY)

        setIsAnalyzing(true)
        try {
            const res = await fetch(`${DIRE_SERVER}/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ frame: frameB64 }),
                signal: AbortSignal.timeout(8000),
            })

            if (!res.ok) return

            const data = await res.json()

            const newScore = data.score ?? 0
            const newLabel: DireLabel = data.label ?? "Likely Real"

            setScore(newScore)
            setLabel(newLabel)
            setMode(data.mode ?? "DCT Heuristic")
            setDctScore(data.dct_score ?? 0)
            setColorScore(data.color_score ?? 0)
            setDireScore(data.dire_score ?? null)

            // Feed into scam detection — maps to the deepfake signal
            updateScore("deepfake", newScore)
        } catch {
            // Transient error — keep last score
        } finally {
            setIsAnalyzing(false)
        }
    }, [videoRef, serverOnline, updateScore])

    useEffect(() => {
        if (!enabled) {
            updateScore("deepfake", 0)
            setScore(0)
            setLabel("Likely Real")
            return
        }

        // Check server health immediately, then every 15 s
        checkServer()
        onlineCheckRef.current = setInterval(checkServer, 15000)

        // Send frames periodically
        const frameTimer = setTimeout(() => {
            sendFrame()
            intervalRef.current = setInterval(sendFrame, SAMPLE_INTERVAL)
        }, 2000)  // 2 s delay to let server health check complete first

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (onlineCheckRef.current) clearInterval(onlineCheckRef.current)
            clearTimeout(frameTimer)
        }
    }, [enabled, checkServer, sendFrame, updateScore])

    return {
        label, score, mode, dctScore, colorScore,
        direScore, serverOnline, isAnalyzing
    }
}
