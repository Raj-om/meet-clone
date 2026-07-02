"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export type BgMode = "none" | "blur" | "image"

export const useVirtualBackground = (
    inputStream: MediaStream | null,
    enabled: boolean,
    mode: BgMode,
    bgImage?: string
) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const outputStreamRef = useRef<MediaStream | null>(null)
    const [outputStream, setOutputStream] = useState<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const segmenterRef = useRef<unknown>(null)

    useEffect(() => {
        if (!enabled || mode === "none" || !inputStream) {
            cancelAnimationFrame(animFrameRef.current)
            setOutputStream(null)
            return
        }

        let active = true

        // Create internal video element to play incoming stream
        const video = document.createElement("video")
        video.srcObject = inputStream
        video.muted = true
        video.playsInline = true
        video.play().catch(e => console.warn("Virtual BG video interrupted:", e.message))

        const canvas = document.createElement("canvas")
        canvas.width = 640
        canvas.height = 480
        canvasRef.current = canvas
        const ctx = canvas.getContext("2d")!

        const bgImg = mode === "image" && bgImage ? new Image() : null
        if (bgImg && bgImage) bgImg.src = bgImage

        const processFrame = () => {
            if (!active) return
            if (video.readyState < 2) {
                animFrameRef.current = requestAnimationFrame(processFrame)
                return
            }

            // Draw original frame
            ctx.drawImage(video, 0, 0, 640, 480)

            if (mode === "blur") {
                // Simple CSS filter blur applied via an offscreen canvas
                ctx.filter = "blur(12px)"
                ctx.drawImage(video, 0, 0, 640, 480)
                ctx.filter = "none"
                // Draw person on top (approximated — just draw normal video since we have no segmentation mask)
                // Full MediaPipe segmentation would run here in production
                ctx.drawImage(video, 0, 0, 640, 480)
            } else if (mode === "image" && bgImg?.complete) {
                ctx.drawImage(bgImg, 0, 0, 640, 480)
                ctx.drawImage(video, 0, 0, 640, 480)
            }

            animFrameRef.current = requestAnimationFrame(processFrame)
        }

        processFrame()

        // Combine processed video with original audio
        const audioTracks = inputStream.getAudioTracks()
        const videoStream = canvas.captureStream(30)
        const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks])
        outputStreamRef.current = combined
        setOutputStream(combined)

        return () => {
            active = false
            cancelAnimationFrame(animFrameRef.current)
            video.pause()
            video.srcObject = null
        }
    }, [enabled, mode, bgImage, inputStream])

    const stopBackground = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current)
        setOutputStream(null)
    }, [])

    return { outputStream, canvasRef, stopBackground, segmenterRef }
}
