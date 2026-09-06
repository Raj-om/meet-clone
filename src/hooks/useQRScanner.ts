"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import jsQR from "jsqr"

interface UseQRScannerOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>
    enabled: boolean
    onQRDetected: (url: string) => void  // Pass the extracted link to the linkScanner
}

const SCAN_INTERVAL_MS = 1000 // Scan for QRs once every second
const MAX_DIM = 400           // Scale down large videos to 400px max for performance

export function useQRScanner({ videoRef, enabled, onQRDetected }: UseQRScannerOptions) {
    const [lastDetectedQR, setLastDetectedQR] = useState<string | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [scanCount, setScanCount] = useState(0)

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastUrlRef = useRef<string | null>(null)

    const scanFrame = useCallback(() => {
        const video = videoRef.current
        if (!video || video.readyState < 2 || !enabled) return

        let sw = video.videoWidth
        let sh = video.videoHeight

        if (sw === 0 || sh === 0) return

        // Scale down to MAX_DIM for faster QR processing
        if (Math.max(sw, sh) > MAX_DIM) {
            const scale = MAX_DIM / Math.max(sw, sh)
            sw = Math.floor(sw * scale)
            sh = Math.floor(sh * scale)
        }

        if (!canvasRef.current) canvasRef.current = document.createElement("canvas")
        const canvas = canvasRef.current
        canvas.width = sw
        canvas.height = sh

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return

        setIsScanning(true)

        try {
            ctx.drawImage(video, 0, 0, sw, sh)
            const imageData = ctx.getImageData(0, 0, sw, sh)

            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            })

            if (code && code.data && code.data !== lastUrlRef.current) {
                // Heuristic: Is it a URL?
                if (code.data.startsWith("http://") || code.data.startsWith("https://")) {
                    lastUrlRef.current = code.data
                    setLastDetectedQR(code.data)
                    if (onQRRef.current) {
                        onQRRef.current(code.data)
                    }
                }
            }
        } catch (e) {
            console.error("[useQRScanner] error:", e)
        } finally {
            setIsScanning(false)
            setScanCount(c => c + 1)
        }
    }, [videoRef, enabled])

    const activeRef = useRef(false)
    const onQRRef = useRef(onQRDetected)
    useEffect(() => { onQRRef.current = onQRDetected }, [onQRDetected])

    useEffect(() => {
        if (!enabled) {
            setIsScanning(false)
            activeRef.current = false
            return
        }

        activeRef.current = true

        const loop = async () => {
            if (!activeRef.current) return
            await scanFrame()
            if (activeRef.current) {
                intervalRef.current = setTimeout(loop, SCAN_INTERVAL_MS)
            }
        }
        loop()

        return () => {
            activeRef.current = false
            if (intervalRef.current) clearTimeout(intervalRef.current)
        }
    }, [enabled, scanFrame])

    return { isScanning, scanCount, lastDetectedQR }
}
