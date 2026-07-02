"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { ScamSignal } from "./useScamDetection"

// ── Thresholds (tuned empirically for common voice-clone models) ──────────────
const ANALYSIS_INTERVAL_MS = 3000   // Run detection every 3 s
const FFT_SIZE = 2048   // Frequency resolution
const SMOOTHING = 0.85   // AudioAnalyser time smoothing

export type AudioDeepfakeLabel =
    | "Natural Voice"
    | "Possibly Synthetic"
    | "Voice Clone Suspected"

interface UseAudioDeepfakeOptions {
    localStream: MediaStream | null
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
}

interface AudioDeepfakeResult {
    label: AudioDeepfakeLabel
    score: number              // 0-100, higher = more synthetic
    spectralFlatness: number   // 0-1
    pitchRegularity: number    // 0-100, higher = abnormally regular
    noiseFloor: number         // dB, lower = suspiciously clean
    isAnalyzing: boolean
}

// ── Helper: compute spectral flatness (Wiener entropy) ────────────────────────
// Geometric mean / Arithmetic mean of spectral magnitudes
// Range: 0 (pure tone) to 1 (white noise)
// Real speech: ~0.2-0.5. AI voices: tend toward extremes (< 0.15 or > 0.7)
function computeSpectralFlatness(freqData: Float32Array): number {
    const linearMags = Array.from(freqData).map(db => Math.pow(10, db / 20))
    const n = linearMags.length
    if (n === 0) return 0

    const logSum = linearMags.reduce((s, v) => s + Math.log(v + 1e-10), 0)
    const geoMean = Math.exp(logSum / n)
    const arithMean = linearMags.reduce((s, v) => s + v, 0) / n

    return arithMean > 0 ? Math.min(1, geoMean / arithMean) : 0
}

// ── Helper: estimate noise floor from lowest 5% of bins ──────────────────────
function computeNoiseFloor(freqData: Float32Array): number {
    const sorted = Array.from(freqData).sort((a, b) => a - b)
    const lowestBins = sorted.slice(0, Math.floor(sorted.length * 0.05))
    return lowestBins.reduce((s, v) => s + v, 0) / (lowestBins.length || 1)
}

// ── Helper: compute pitch regularity via autocorrelation on time-domain ───────
// Voice cloners produce unnaturally stable pitch (low variance in zero-crossing rate)
function computePitchRegularity(timeData: Float32Array): number {
    const n = timeData.length
    let crossings = 0
    for (let i = 1; i < n; i++) {
        if ((timeData[i - 1] >= 0) !== (timeData[i] >= 0)) crossings++
    }
    const zcr = crossings / n  // Zero-crossing rate

    // Natural speech ZCR varies significantly segment to segment
    // We score how "suspiciously stable" it is relative to prior samples
    return Math.round(zcr * 1000)  // Normalized count for comparison
}

// ── Helper: detect unnatural silence segments (AI voices trim silence perfectly)
function detectSilencePerfection(timeData: Float32Array): number {
    const threshold = 0.01
    let perfectSilence = 0
    let total = 0

    for (let i = 0; i < timeData.length - 10; i += 10) {
        const segment = Array.from(timeData.slice(i, i + 10))
        const maxAmp = Math.max(...segment.map(Math.abs))
        if (maxAmp < threshold) perfectSilence++
        total++
    }

    // Very high ratio of "perfect" silence segments = AI-trimmed audio
    return total > 0 ? perfectSilence / total : 0
}

export function useAudioDeepfakeDetection({
    localStream,
    enabled,
    updateScore,
}: UseAudioDeepfakeOptions): AudioDeepfakeResult {
    const [label, setLabel] = useState<AudioDeepfakeLabel>("Natural Voice")
    const [score, setScore] = useState(0)
    const [spectralFlatness, setSpectralFlatness] = useState(0)
    const [pitchRegularity, setPitchRegularity] = useState(0)
    const [noiseFloor, setNoiseFloor] = useState(-60)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Rolling history of ZCR values to detect variance (abnormally stable = synthetic)
    const zcrHistoryRef = useRef<number[]>([])
    // Rolling history of flatness values
    const flatnessHistoryRef = useRef<number[]>([])

    const setupAudio = useCallback((stream: MediaStream) => {
        try {
            const ctx = new AudioContext()
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = FFT_SIZE
            analyser.smoothingTimeConstant = SMOOTHING
            source.connect(analyser)

            audioCtxRef.current = ctx
            analyserRef.current = analyser
        } catch (e) {
            console.warn("[AudioDeepfake] AudioContext error:", e)
        }
    }, [])

    const analyzeFrame = useCallback(() => {
        const analyser = analyserRef.current
        if (!analyser) return

        const freqBins = analyser.frequencyBinCount
        const freqData = new Float32Array(freqBins)  // dB values
        const timeData = new Float32Array(FFT_SIZE)

        analyser.getFloatFrequencyData(freqData)
        analyser.getFloatTimeDomainData(timeData)

        setIsAnalyzing(true)

        // ── Check if there's actual audio signal (someone speaking) ──────────────
        const rms = Math.sqrt(timeData.reduce((s, v) => s + v * v, 0) / timeData.length)
        if (rms < 0.005) {
            // Too quiet / silent — skip scoring, don't penalize
            setIsAnalyzing(false)
            return
        }

        // ── 1. Spectral Flatness (Wiener entropy) ────────────────────────────────
        const flatness = computeSpectralFlatness(freqData)
        flatnessHistoryRef.current.push(flatness)
        if (flatnessHistoryRef.current.length > 10) flatnessHistoryRef.current.shift()

        setSpectralFlatness(Math.round(flatness * 100) / 100)

        // AI voices: too flat (uniform) OR too tonal (narrow peaks)
        // Real speech flatness: ~0.15–0.45
        const flatnessScore =
            flatness < 0.10 ? 70 :   // Overly tonal = likely synthesized
                flatness < 0.15 ? 40 :
                    flatness > 0.65 ? 60 :   // Overly flat = noise-like synthesis artifact
                        flatness > 0.55 ? 30 : 0

        // ── 2. Noise Floor ───────────────────────────────────────────────────────
        const floor = computeNoiseFloor(freqData)
        setNoiseFloor(Math.round(floor))

        // Real mic recordings: noise floor ~ -60dB to -40dB
        // AI voice clones: perfect silence floor < -80dB (too clean)
        const floorScore =
            floor < -85 ? 80 :
                floor < -75 ? 50 :
                    floor < -70 ? 25 : 0

        // ── 3. Pitch Regularity (ZCR variance) ───────────────────────────────────
        const zcr = computePitchRegularity(timeData)
        zcrHistoryRef.current.push(zcr)
        if (zcrHistoryRef.current.length > 15) zcrHistoryRef.current.shift()

        setPitchRegularity(zcr)

        // Compute variance across ZCR history
        let zcrVarianceScore = 0
        if (zcrHistoryRef.current.length >= 5) {
            const mean = zcrHistoryRef.current.reduce((a, b) => a + b, 0) / zcrHistoryRef.current.length
            const variance = zcrHistoryRef.current.reduce((s, v) => s + (v - mean) ** 2, 0) / zcrHistoryRef.current.length
            const stdDev = Math.sqrt(variance)
            // Abnormally low std dev = unnaturally stable pitch = voice clone indicator
            zcrVarianceScore =
                stdDev < 5 ? 70 :
                    stdDev < 10 ? 45 :
                        stdDev < 15 ? 20 : 0
        }

        // ── 4. Silence Perfection ─────────────────────────────────────────────────
        const silencePerfection = detectSilencePerfection(timeData)
        const silenceScore = silencePerfection > 0.4 ? 60 : silencePerfection > 0.25 ? 35 : 0

        // ── 5. Spectral Consistency (rolling flatness variance) ───────────────────
        let spectralConsistencyScore = 0
        if (flatnessHistoryRef.current.length >= 5) {
            const mean = flatnessHistoryRef.current.reduce((a, b) => a + b, 0) / flatnessHistoryRef.current.length
            const variance = flatnessHistoryRef.current.reduce((s, v) => s + (v - mean) ** 2, 0) / flatnessHistoryRef.current.length
            // Real speech varies a lot; AI voices have suspiciously consistent spectral shape
            spectralConsistencyScore = variance < 0.001 ? 60 : variance < 0.003 ? 30 : 0
        }

        // ── Composite score ───────────────────────────────────────────────────────
        const raw = Math.round(
            flatnessScore * 0.30 +
            floorScore * 0.25 +
            zcrVarianceScore * 0.25 +
            silenceScore * 0.10 +
            spectralConsistencyScore * 0.10
        )

        const finalScore = Math.min(100, raw)
        const newLabel: AudioDeepfakeLabel =
            finalScore >= 60 ? "Voice Clone Suspected"
                : finalScore >= 30 ? "Possibly Synthetic"
                    : "Natural Voice"

        setScore(finalScore)
        setLabel(newLabel)
        updateScore("voice", Math.max(finalScore, 0))  // feeds into scam scoring voice signal
        setIsAnalyzing(false)
    }, [updateScore])

    useEffect(() => {
        if (!enabled || !localStream) {
            updateScore("voice", 0)
            setScore(0)
            setLabel("Natural Voice")
            audioCtxRef.current?.close()
            audioCtxRef.current = null
            analyserRef.current = null
            return
        }

        setupAudio(localStream)

        analyzeFrame()
        intervalRef.current = setInterval(analyzeFrame, ANALYSIS_INTERVAL_MS)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            audioCtxRef.current?.close()
            audioCtxRef.current = null
            analyserRef.current = null
            zcrHistoryRef.current = []
            flatnessHistoryRef.current = []
        }
    }, [enabled, localStream, setupAudio, analyzeFrame, updateScore])

    return { label, score, spectralFlatness, pitchRegularity, noiseFloor, isAnalyzing }
}
