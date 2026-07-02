"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Socket } from "socket.io-client"

export interface Caption {
    speakerId: string
    speakerName: string
    text: string
    timestamp: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any

export const useCaptions = (socket: Socket | null, userId: string, displayName: string, enabled: boolean) => {
    const [captions, setCaptions] = useState<Caption[]>([])
    const recognitionRef = useRef<AnyRecognition>(null)

    // Receive captions from remote peers
    useEffect(() => {
        if (!socket) return
        const onCaption = (cap: Caption) => {
            if (cap.speakerId === userId) return
            setCaptions(prev => {
                const updated = [...prev.filter(c => c.speakerId !== cap.speakerId), cap]
                return updated.slice(-5)
            })
            setTimeout(() => setCaptions(prev => prev.filter(c => c.timestamp !== cap.timestamp)), 6000)
        }
        socket.on("caption", onCaption)
        return () => { socket.off("caption", onCaption) }
    }, [socket, userId])

    // Local speech recognition
    useEffect(() => {
        if (!enabled) {
            recognitionRef.current?.stop()
            return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognitionAPI) return

        const rec = new SpeechRecognitionAPI()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = "en-US"
        recognitionRef.current = rec

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
            let text = ""
            for (let i = e.resultIndex; i < e.results.length; i++) {
                text += e.results[i][0].transcript
            }
            const cap: Caption = { speakerId: userId, speakerName: displayName, text, timestamp: Date.now() }
            setCaptions(prev => {
                const updated = [...prev.filter(c => c.speakerId !== userId), cap]
                return updated.slice(-5)
            })
            socket?.emit("caption", cap)
        }

        rec.onerror = () => { /* ignore */ }
        rec.onend = () => { if (enabled) rec.start() }

        rec.start()
        return () => { try { rec.stop() } catch { /* ignore */ } }
    }, [enabled, socket, userId, displayName])

    const latestCaption = captions[captions.length - 1] ?? null

    const clearCaptions = useCallback(() => setCaptions([]), [])

    return { captions, latestCaption, clearCaptions }
}
