"use client"

import { useEffect } from "react"

export default function SuppressWasmAbort() {
    useEffect(() => {
        if (typeof window === "undefined") return

        const originalError = console.error
        console.error = (...args: any[]) => {
            if (args[0] && typeof args[0] === 'string') {
                if (
                    args[0].includes("Abort handler called") || 
                    args[0].includes("Created TensorFlow Lite XNNPACK delegate for CPU") ||
                    args[0].includes("DataChannel error on lossy: User-Initiated Abort") ||
                    args[0].includes("closed unexpectedly")
                ) {
                    // Silently swallow harmless WebWorker aborts from ONNX/MediaPipe during navigation
                    return
                }
            }
            originalError.apply(console, args)
        }

        return () => {
            console.error = originalError
        }
    }, [])

    return null
}
