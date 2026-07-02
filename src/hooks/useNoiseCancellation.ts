"use client"

import { useEffect, useRef, useState, useCallback } from "react"

/**
 * Applies a noise gate to the local audio stream using Web Audio API.
 * When enabled, audio below the threshold is muted to reduce background noise.
 */
export const useNoiseCancellation = (localStream: MediaStream | null, enabled: boolean) => {
    const ctxRef = useRef<AudioContext | null>(null)
    const gainRef = useRef<GainNode | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
    const [processedStream, setProcessedStream] = useState<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const THRESHOLD = 15 // RMS value below which audio is gated

    const cleanup = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current)
        ctxRef.current?.close()
        ctxRef.current = null
        gainRef.current = null
        setProcessedStream(null)
    }, [])

    useEffect(() => {
        if (!enabled || !localStream) { cleanup(); return }

        const audioTracks = localStream.getAudioTracks()
        if (audioTracks.length === 0) return

        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(localStream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        const gain = ctx.createGain()
        const destination = ctx.createMediaStreamDestination()

        source.connect(analyser)
        analyser.connect(gain)
        gain.connect(destination)

        ctxRef.current = ctx
        gainRef.current = gain
        analyserRef.current = analyser
        destinationRef.current = destination

        // Build a new stream: processed audio + original video
        const videoTracks = localStream.getVideoTracks()
        const combined = new MediaStream([...destination.stream.getAudioTracks(), ...videoTracks])
        setProcessedStream(combined)

        const data = new Uint8Array(analyser.frequencyBinCount)

        const gate = () => {
            analyser.getByteFrequencyData(data)
            const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
            // Smooth gain transition
            const target = rms > THRESHOLD ? 1 : 0
            const current = gain.gain.value
            gain.gain.value = current + (target - current) * 0.3
            animFrameRef.current = requestAnimationFrame(gate)
        }
        gate()

        return cleanup
    }, [enabled, localStream, cleanup])

    return { processedStream }
}
