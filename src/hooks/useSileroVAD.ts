"use client"

/**
 * useSileroVAD.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Machine-learning Voice Activity Detector using Silero VAD via ONNX Runtime.
 *
 * Research basis (2025/2026):
 *   Silero VAD is a state-of-the-art, lightweight ML model (1.8 MB) that
 *   outperforms threshold-based gating in noisy environments. It ships as an
 *   ONNX file and runs natively via onnxruntime-web (already in package.json).
 *
 * Model: silero-vad (v4) — runs FULLY locally, no network needed after load.
 *
 * How it works:
 *   • Raw PCM frames (512 samples @ 16 kHz) flow into the ONNX session
 *   • The model outputs a speech probability (0–1) per frame
 *   • A hysteresis-based state machine converts probabilities into SPEECH/SILENCE
 *   • A GainNode on the AudioContext is smoothly ramped to 1 (speech) or 0 (silence)
 *
 * Graceful degradation:
 *   If the ONNX model fails to load (e.g., CSP restrictions), the hook falls
 *   back to the original RMS energy threshold gating from useNoiseCancellation.
 */

import { useEffect, useRef, useState, useCallback } from "react"

// ── Silero VAD model URL (served via public CDN, cached locally by browser) ──
const SILERO_VAD_MODEL_URL =
    "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/silero_vad.onnx"

// ── Config ────────────────────────────────────────────────────────────────────
const SAMPLE_RATE     = 16_000   // Silero VAD requires exactly 16 kHz
const FRAME_SAMPLES   = 512      // ~32ms per frame at 16 kHz
const SPEECH_THRESHOLD  = 0.5    // Prob above → consider speech
const SILENCE_THRESHOLD = 0.35   // Prob below → consider silence (hysteresis)
const SPEECH_PAD_MS   = 300      // Keep gain up for N ms after speech ends

export interface SileroVADResult {
    isSpeaking: boolean
    speechProbability: number     // 0–1 from Silero VAD model
    modelReady: boolean
    usingFallback: boolean        // true if running RMS fallback
    processedStream: MediaStream | null
}

export function useSileroVAD(
    localStream: MediaStream | null,
    enabled: boolean,
): SileroVADResult {
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [speechProbability, setSpeechProbability] = useState(0)
    const [modelReady, setModelReady] = useState(false)
    const [usingFallback, setUsingFallback] = useState(false)

    // Using 'any' instead of 'ort.InferenceSession' to avoid static import crashes in Next.js
    const sessionRef        = useRef<any>(null)
    const ortRef            = useRef<any>(null) // cache the dynamically imported ort library
    const stateHRef         = useRef<Float32Array>(new Float32Array(2 * 1 * 64).fill(0))
    const stateCRef         = useRef<Float32Array>(new Float32Array(2 * 1 * 64).fill(0))

    const audioCtxRef       = useRef<AudioContext | null>(null)
    const gainRef           = useRef<GainNode | null>(null)
    const processorRef      = useRef<ScriptProcessorNode | null>(null)
    const pcmBufferRef      = useRef<Float32Array[]>([])
    const animFrameRef      = useRef<number>(0)
    const speechPadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [processedStream, setProcessedStream]   = useState<MediaStream | null>(null)

    // ── Load Silero VAD ONNX model ─────────────────────────────────────────
    useEffect(() => {
        if (!enabled) return
        let mounted = true

        async function loadModel() {
            try {
                // Dynamically import onnxruntime-web to avoid Webpack/Turbopack errors
                const ort = await import("onnxruntime-web")
                ortRef.current = ort
                
                ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/"
                const session = await ort.InferenceSession.create(SILERO_VAD_MODEL_URL, {
                    executionProviders: ["wasm"],
                    graphOptimizationLevel: "all",
                })
                if (mounted) {
                    sessionRef.current = session
                    setModelReady(true)
                    setUsingFallback(false)
                }
            } catch (err) {
                console.warn("[useSileroVAD] Model load failed, using RMS fallback:", err)
                if (mounted) setUsingFallback(true)
            }
        }

        loadModel()
        return () => { mounted = false }
    }, [enabled])

    // ── Resample from browser sample rate to 16 kHz ────────────────────────
    const resampleTo16k = useCallback((buffer: Float32Array, fromRate: number): Float32Array => {
        if (fromRate === SAMPLE_RATE) return buffer
        const ratio  = fromRate / SAMPLE_RATE
        const outLen = Math.round(buffer.length / ratio)
        const out    = new Float32Array(outLen)
        for (let i = 0; i < outLen; i++) {
            const src  = i * ratio
            const lo   = Math.floor(src)
            const hi   = Math.min(lo + 1, buffer.length - 1)
            out[i]     = buffer[lo] * (1 - (src - lo)) + buffer[hi] * (src - lo)
        }
        return out
    }, [])

    // ── Run Silero VAD inference on a 512-sample frame ─────────────────────
    const runVAD = useCallback(async (frame: Float32Array): Promise<number> => {
        const session = sessionRef.current
        const ort = ortRef.current
        if (!session || !ort) return 0

        const inputTensor = new ort.Tensor("float32", frame, [1, FRAME_SAMPLES])
        const srTensor    = new ort.Tensor("int64", BigInt64Array.from([BigInt(SAMPLE_RATE)]), [])
        const hTensor     = new ort.Tensor("float32", stateHRef.current, [2, 1, 64])
        const cTensor     = new ort.Tensor("float32", stateCRef.current, [2, 1, 64])

        try {
            const result = await session.run({
                input: inputTensor,
                sr: srTensor,
                h: hTensor,
                c: cTensor,
            })
            // Update hidden states for next frame (stateful RNN)
            stateHRef.current = result.hn.data as Float32Array
            stateCRef.current = result.cn.data as Float32Array

            const prob = (result.output.data as Float32Array)[0]
            return prob
        } catch {
            return 0
        }
    }, [])

    // ── Audio pipeline setup ───────────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !localStream) {
            gainRef.current?.gain.setTargetAtTime(1, 0, 0.05)
            processorRef.current?.disconnect()
            audioCtxRef.current?.close()
            audioCtxRef.current  = null
            processorRef.current = null
            setProcessedStream(null)
            return
        }

        const audioTracks = localStream.getAudioTracks()
        if (audioTracks.length === 0) return

        const ctx  = new AudioContext()
        const gain = ctx.createGain()
        gain.gain.value = 1

        const source      = ctx.createMediaStreamSource(localStream)
        const destination = ctx.createMediaStreamDestination()

        source.connect(gain)
        gain.connect(destination)

        audioCtxRef.current = ctx
        gainRef.current     = gain

        const videoTracks = localStream.getVideoTracks()
        const combined    = new MediaStream([...destination.stream.getAudioTracks(), ...videoTracks])
        setProcessedStream(combined)

        // ── Fallback: RMS gate (used if model load failed) ─────────────────
        if (usingFallback) {
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)
            const data = new Uint8Array(analyser.frequencyBinCount)

            const gate = () => {
                analyser.getByteFrequencyData(data)
                const rmsVal = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
                const prob   = Math.min(1, rmsVal / 50)
                setSpeechProbability(prob)
                const speaking = prob > 0.3
                setIsSpeaking(speaking)
                gain.gain.setTargetAtTime(speaking ? 1 : 0, ctx.currentTime, 0.05)
                animFrameRef.current = requestAnimationFrame(gate)
            }
            gate()
            return () => {
                cancelAnimationFrame(animFrameRef.current)
                analyser.disconnect()
                gain.disconnect()
                destination.disconnect()
                ctx.close()
                audioCtxRef.current = null
                gainRef.current     = null
                setProcessedStream(null)
            }
        }

        // ── ML VAD: ScriptProcessor collects PCM frames ────────────────────
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = async (e) => {
            const rawData    = e.inputBuffer.getChannelData(0)
            const resampled  = resampleTo16k(new Float32Array(rawData), ctx.sampleRate)
            pcmBufferRef.current.push(resampled)

            // Process in FRAME_SAMPLES blocks
            const totalFrameSamples = FRAME_SAMPLES
            const combined16k: number[] = []
            for (const chunk of pcmBufferRef.current) {
                combined16k.push(...chunk)
            }
            pcmBufferRef.current = []

            let offset = 0
            while (offset + totalFrameSamples <= combined16k.length) {
                const frame = new Float32Array(combined16k.slice(offset, offset + totalFrameSamples))
                offset += totalFrameSamples

                const prob = await runVAD(frame)
                setSpeechProbability(prob)

                const currentlySpeaking = isSpeaking
                if (prob >= SPEECH_THRESHOLD) {
                    setIsSpeaking(true)
                    if (speechPadTimerRef.current) clearTimeout(speechPadTimerRef.current)
                    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.02)
                } else if (prob < SILENCE_THRESHOLD && currentlySpeaking) {
                    // Pad silence — keep gain up briefly to avoid clipping word endings
                    if (!speechPadTimerRef.current) {
                        speechPadTimerRef.current = setTimeout(() => {
                            setIsSpeaking(false)
                            gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
                            speechPadTimerRef.current = null
                        }, SPEECH_PAD_MS)
                    }
                }
            }

            if (offset < combined16k.length) {
                pcmBufferRef.current = [new Float32Array(combined16k.slice(offset))]
            }
        }

        source.connect(processor)
        processor.connect(ctx.destination)
        processorRef.current = processor

        return () => {
            cancelAnimationFrame(animFrameRef.current)
            if (speechPadTimerRef.current) clearTimeout(speechPadTimerRef.current)
            processor.disconnect()
            gain.disconnect()
            ctx.close()
            audioCtxRef.current  = null
            gainRef.current      = null
            processorRef.current = null
            setProcessedStream(null)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, localStream, modelReady, usingFallback, resampleTo16k, runVAD])

    return { isSpeaking, speechProbability, modelReady, usingFallback, processedStream }
}
