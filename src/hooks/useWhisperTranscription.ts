"use client"

/**
 * useWhisperTranscription.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that drives the Whisper Web Worker.
 *
 * Architecture:
 *   localStream ──► AudioContext ──► ScriptProcessor ──► rollingBuffer
 *                                                         │
 *                                        every CHUNK_SEC  ▼
 *                                    whisperWorker.postMessage({ type:"TRANSCRIBE", pcm })
 *                                                         │
 *                                        worker returns   ▼
 *                                        { type:"TRANSCRIPT", text }
 *
 * The rolling buffer collects audio at native sample rate, then resamples
 * to 16 kHz (Whisper's expected rate) before sending to the worker.
 */

import { useEffect, useRef, useState, useCallback } from "react"

// ── Public types ──────────────────────────────────────────────────────────────
export interface TranscriptSegment {
    id: string
    text: string
    speakerName: string
    timestamp: number
}

export interface WhisperTranscriptionResult {
    /** Latest caption to show in the video overlay */
    latestCaption: { speakerName: string; text: string } | null
    /** All transcript segments accumulated during this session */
    transcriptHistory: TranscriptSegment[]
    /** Download progress while the model loads (0–100) */
    modelLoadProgress: number
    /** Human-readable loading stage ("model", "decoder", etc.) */
    modelLoadStage: string
    /** true once the model is downloaded and ready */
    isReady: boolean
    /** true while a transcription inference is running */
    isTranscribing: boolean
    /** Any error from the worker */
    error: string | null
    /** Clear accumulated transcript (called at meeting end to snapshot) */
    getFullTranscript: () => string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TARGET_SAMPLE_RATE = 16_000   // Whisper requires 16 kHz mono PCM
const CHUNK_SEC          = 4        // Send a chunk every N seconds
const SILENCE_THRESHOLD  = 0.005   // Skip silent chunks (RMS below this)

// ── Resample helper (linear interpolation) ────────────────────────────────────
function resampleTo16k(buffer: Float32Array, fromRate: number): Float32Array {
    if (fromRate === TARGET_SAMPLE_RATE) return buffer
    const ratio   = fromRate / TARGET_SAMPLE_RATE
    const outLen  = Math.round(buffer.length / ratio)
    const out     = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
        const src   = i * ratio
        const lo    = Math.floor(src)
        const hi    = Math.min(lo + 1, buffer.length - 1)
        const frac  = src - lo
        out[i]      = buffer[lo] * (1 - frac) + buffer[hi] * frac
    }
    return out
}

// ── RMS loudness check ────────────────────────────────────────────────────────
function rms(buf: Float32Array): number {
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    return Math.sqrt(sum / buf.length)
}

export function useWhisperTranscription(
    localStream: MediaStream | null,
    displayName: string,
    enabled: boolean,
): WhisperTranscriptionResult {
    const workerRef         = useRef<Worker | null>(null)
    const audioCtxRef       = useRef<AudioContext | null>(null)
    const processorRef      = useRef<ScriptProcessorNode | null>(null)
    const rollingBufferRef  = useRef<Float32Array[]>([])
    const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null)
    const captionTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [latestCaption, setLatestCaption]           = useState<{ speakerName: string; text: string } | null>(null)
    const [transcriptHistory, setTranscriptHistory]   = useState<TranscriptSegment[]>([])
    const [modelLoadProgress, setModelLoadProgress]   = useState(0)
    const [modelLoadStage, setModelLoadStage]         = useState("")
    const [isReady, setIsReady]                       = useState(false)
    const [isTranscribing, setIsTranscribing]         = useState(false)
    const [error, setError]                           = useState<string | null>(null)

    // ── Spawn worker once on mount ─────────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            const w = new Worker(
                new URL("../workers/whisperWorker.ts", import.meta.url),
                { type: "module" }
            )
            workerRef.current = w

            w.onmessage = (e) => {
                const msg = e.data
                switch (msg.type) {
                    case "READY":
                        setIsReady(true)
                        setModelLoadProgress(100)
                        break
                    case "LOADING":
                        setModelLoadProgress(msg.progress)
                        setModelLoadStage(msg.stage)
                        break
                    case "TRANSCRIPT": {
                        const text: string = msg.text
                        if (!text) break
                        setIsTranscribing(false)
                        const seg: TranscriptSegment = {
                            id: `${Date.now()}-${Math.random()}`,
                            text,
                            speakerName: displayName,
                            timestamp: Date.now(),
                        }
                        setTranscriptHistory(prev => [...prev, seg])
                        setLatestCaption({ speakerName: displayName, text })
                        // Auto-clear caption overlay after 6 s
                        if (captionTimerRef.current) clearTimeout(captionTimerRef.current)
                        captionTimerRef.current = setTimeout(() => setLatestCaption(null), 6000)
                        break
                    }
                    case "ERROR":
                        setError(msg.message)
                        setIsTranscribing(false)
                        break
                }
            }

            w.onerror = (err) => setError(err.message)

            // Kick off model download immediately so it's ready when user enables captions
            w.postMessage({ type: "INIT" })
        } catch (err) {
            console.warn("[useWhisperTranscription] Worker init failed:", err)
        }

        return () => {
            workerRef.current?.terminate()
            workerRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Audio capture pipeline ─────────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !localStream || !isReady) {
            // Teardown audio graph if disabled
            processorRef.current?.disconnect()
            audioCtxRef.current?.close()
            audioCtxRef.current  = null
            processorRef.current = null
            rollingBufferRef.current = []
            if (timerRef.current) clearInterval(timerRef.current)
            return
        }

        const audioTracks = localStream.getAudioTracks()
        if (audioTracks.length === 0) return

        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(localStream)

        // ScriptProcessor gives us raw PCM floats — deprecated but still the
        // most cross-browser way to get float32 mic data without extra deps
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (e) => {
            const data = e.inputBuffer.getChannelData(0)
            rollingBufferRef.current.push(new Float32Array(data))
        }

        source.connect(processor)
        processor.connect(ctx.destination)  // must connect or Chrome won't fire

        audioCtxRef.current  = ctx
        processorRef.current = processor

        // Every CHUNK_SEC, flush buffer → resample → send to worker
        timerRef.current = setInterval(() => {
            if (rollingBufferRef.current.length === 0) return
            if (!workerRef.current || !isReady) return

            // Concat all accumulated chunks
            const totalLen = rollingBufferRef.current.reduce((s, b) => s + b.length, 0)
            const merged   = new Float32Array(totalLen)
            let offset     = 0
            for (const chunk of rollingBufferRef.current) {
                merged.set(chunk, offset)
                offset += chunk.length
            }
            rollingBufferRef.current = []   // reset accumulator

            // Skip silence
            if (rms(merged) < SILENCE_THRESHOLD) return

            // Resample to 16 kHz
            const pcm = resampleTo16k(merged, ctx.sampleRate)

            setIsTranscribing(true)
            // Transfer ownership to avoid copying
            workerRef.current.postMessage({ type: "TRANSCRIBE", pcm, sampleRate: TARGET_SAMPLE_RATE }, [pcm.buffer])
        }, CHUNK_SEC * 1000)

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            processor.disconnect()
            ctx.close()
            audioCtxRef.current  = null
            processorRef.current = null
            rollingBufferRef.current = []
        }
    }, [enabled, localStream, isReady])

    const getFullTranscript = useCallback(() => {
        return transcriptHistory.map(s => `[${new Date(s.timestamp).toLocaleTimeString()}] ${s.speakerName}: ${s.text}`).join("\n")
    }, [transcriptHistory])

    return {
        latestCaption,
        transcriptHistory,
        modelLoadProgress,
        modelLoadStage,
        isReady,
        isTranscribing,
        error,
        getFullTranscript,
    }
}
