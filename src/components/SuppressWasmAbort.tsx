"use client"

import { useEffect } from "react"

export default function SuppressWasmAbort() {
    useEffect(() => {
        if (typeof window === "undefined") return

        const originalError = console.error
        console.error = (...args: any[]) => {
            if (args[0] && typeof args[0] === 'string' && args[0].includes("Abort handler called")) {
                // Silently swallow harmless WebWorker aborts from ONNX/MediaPipe during navigation
                return
            }
            originalError.apply(console, args)
        }

        return () => {
            console.error = originalError
        }
    }, [])

    return null
}
