"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ScamSignal } from "./useScamDetection"

const FFT_SIZE = 2048
const SAMPLE_RATE_MS = 100      // Analyze 10x per second
const HISTORY_LEN = 100         // 10 seconds of history
const PITCH_HISTORY_LEN = 30    // 3 seconds for tremor detection

export interface StressVoiceResult {
    currentPitch: number          // Hz — fundamental frequency (F0)
    pitchVariance: number         // 0-100: how much pitch fluctuates (tremor)
    speechRate: number            // syllables-per-minute estimate
    voiceEnergy: number           // 0-100: current volume level
    stressLevel: number           // 0-100: composite stress score
    isSpeaking: boolean
    microTremorDetected: boolean  // rapid pitch jitter = anxiety
    label: "Calm" | "Stressed" | "Panicking"
}

interface UseStressVoiceOptions {
    stream: MediaStream | null
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
}

/** Autocorrelation-based pitch estimation (YIN-inspired, browser-optimized) */
function estimatePitch(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length
    const MAX_SAMPLES = Math.floor(SIZE / 2)
    let bestOffset = -1
    let bestCorrelation = 0
    let rms = 0
    let foundGoodCorrelation = false
    const correlations: number[] = new Array(MAX_SAMPLES)

    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i]
    rms = Math.sqrt(rms / SIZE)

    if (rms < 0.01) return -1  // Below voice threshold — silence

    let lastCorrelation = 1
    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
        let correlation = 0
        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs(buffer[i] - buffer[i + offset])
        }
        correlation = 1 - correlation / MAX_SAMPLES
        correlations[offset] = correlation

        if (correlation > 0.9 && correlation > lastCorrelation) {
            foundGoodCorrelation = true
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation
                bestOffset = offset
            }
        } else if (foundGoodCorrelation) {
            // Refine: interpolate between samples
            const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) /
                (2 * correlations[bestOffset] - correlations[bestOffset - 1] - correlations[bestOffset + 1]) * 0.5
            return sampleRate / (bestOffset + shift)
        }
        lastCorrelation = correlation
    }
    if (bestOffset === -1) return -1
    return sampleRate / bestOffset
}

/** Spectral centroid — correlates with voice brightness / tension */
function computeSpectralCentroid(freqData: Uint8Array, sampleRate: number): number {
    let weightedSum = 0
    let magnitudeSum = 0
    const binHz = sampleRate / (2 * freqData.length)
    for (let i = 0; i < freqData.length; i++) {
        const mag = freqData[i]
        weightedSum += mag * (i * binHz)
        magnitudeSum += mag
    }
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
}

export function useStressVoiceDetection({
    stream, enabled, updateScore
}: UseStressVoiceOptions): StressVoiceResult {
    const [currentPitch, setCurrentPitch] = useState(0)
    const [pitchVariance, setPitchVariance] = useState(0)
    const [speechRate, setSpeechRate] = useState(0)
    const [voiceEnergy, setVoiceEnergy] = useState(0)
    const [stressLevel, setStressLevel] = useState(0)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [microTremorDetected, setMicroTremorDetected] = useState(false)
    const [label, setLabel] = useState<"Calm" | "Stressed" | "Panicking">("Calm")

    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const pitchHistoryRef = useRef<number[]>([])
    const energyHistoryRef = useRef<number[]>([])
    const speechSegmentsRef = useRef<number[]>([])  // timestamps when speech detected
    const wasSpokingRef = useRef(false)

    const setupAudio = useCallback((s: MediaStream) => {
        try {
            const ctx = new AudioContext()
            const analyser = ctx.createAnalyser()
            analyser.fftSize = FFT_SIZE
            analyser.smoothingTimeConstant = 0.3
            const source = ctx.createMediaStreamSource(s)
            source.connect(analyser)
            audioCtxRef.current = ctx
            analyserRef.current = analyser
            sourceRef.current = source
        } catch (e) {
            console.warn("[useStressVoiceDetection] AudioContext error:", e)
        }
    }, [])

    const analyze = useCallback(() => {
        const analyser = analyserRef.current
        const ctx = audioCtxRef.current
        if (!analyser || !ctx) return

        const bufferLen = analyser.frequencyBinCount
        const freqData = new Uint8Array(bufferLen)
        const timeData = new Float32Array(FFT_SIZE)

        analyser.getByteFrequencyData(freqData)
        analyser.getFloatTimeDomainData(timeData)

        // ── Voice energy (RMS) ─────────────────────────────────────────────
        let rms = 0
        for (let i = 0; i < timeData.length; i++) rms += timeData[i] * timeData[i]
        rms = Math.sqrt(rms / timeData.length)
        const energy = Math.min(100, Math.round(rms * 500))
        setVoiceEnergy(energy)

        const speaking = energy > 8
        setIsSpeaking(speaking)

        if (speaking) {
            speechSegmentsRef.current.push(Date.now())
            // Keep last 60s
            const cutoff = Date.now() - 60000
            speechSegmentsRef.current = speechSegmentsRef.current.filter(t => t > cutoff)
        }

        // Estimate speech rate from energy bursts (syllable detection)
        // Count transitions from non-speech to speech in last 10s
        const recentCutoff = Date.now() - 10000
        const recentSegments = speechSegmentsRef.current.filter(t => t > recentCutoff)
        // Simple: count distinct bursts (segments separated by >100ms)
        let bursts = 0
        let lastBurst = 0
        for (const t of recentSegments) {
            if (t - lastBurst > 100) { bursts++; lastBurst = t }
        }
        setSpeechRate(Math.round(bursts * 6))  // scale to syllables/minute

        // ── Pitch estimation (only when speaking) ─────────────────────────
        if (speaking) {
            const pitch = estimatePitch(timeData, ctx.sampleRate)
            if (pitch > 80 && pitch < 1200) {  // Valid human voice range
                setCurrentPitch(Math.round(pitch))
                pitchHistoryRef.current.push(pitch)
                if (pitchHistoryRef.current.length > PITCH_HISTORY_LEN) {
                    pitchHistoryRef.current.shift()
                }
            }
        }

        // ── Pitch variance (tremor detection) ─────────────────────────────
        const pitchH = pitchHistoryRef.current
        if (pitchH.length >= 5) {
            const mean = pitchH.reduce((a, b) => a + b, 0) / pitchH.length
            const variance = pitchH.reduce((s, v) => s + (v - mean) ** 2, 0) / pitchH.length
            const stdDev = Math.sqrt(variance)

            // Normal speech pitch std: 20-60Hz
            // Stressed/tremor: >80Hz rapid fluctuation
            const varianceScore = stdDev > 80 ? 90 : stdDev > 60 ? 65 : stdDev > 40 ? 35 : 10
            setPitchVariance(varianceScore)
            setMicroTremorDetected(stdDev > 80)
        }

        // ── Spectral centroid (voice brightness/tension) ───────────────────
        const centroid = computeSpectralCentroid(freqData, ctx.sampleRate)
        // Stressed voices tend to have higher spectral centroid (brighter, tenser)
        const centroidScore = centroid > 3000 ? 70 : centroid > 2000 ? 40 : 10

        // ── Composite stress score ─────────────────────────────────────────
        const pv = pitchHistoryRef.current.length >= 5
            ? pitchVariance
            : 0

        const sr = speechRate
        // Rapid speech rate (>180 syllables/min) also correlates with stress
        const speechRateScore = sr > 180 ? 60 : sr > 140 ? 35 : 0

        energyHistoryRef.current.push(energy)
        if (energyHistoryRef.current.length > HISTORY_LEN) energyHistoryRef.current.shift()

        // Energy spikes: sudden jumps in volume = startled reaction
        let energySpikeScore = 0
        if (energyHistoryRef.current.length > 5) {
            const recentE = energyHistoryRef.current.slice(-5)
            const maxE = Math.max(...recentE)
            const minE = Math.min(...recentE)
            if (maxE - minE > 60) energySpikeScore = 50
        }

        const composite = Math.min(100, Math.round(
            pv * 0.35 +
            centroidScore * 0.25 +
            speechRateScore * 0.20 +
            energySpikeScore * 0.20
        ))

        setStressLevel(composite)

        const newLabel: "Calm" | "Stressed" | "Panicking" =
            composite >= 70 ? "Panicking" : composite >= 40 ? "Stressed" : "Calm"
        setLabel(newLabel)

        // Feed into voice signal channel
        updateScore("voice", composite)

    }, [pitchVariance, speechRate, updateScore])

    useEffect(() => {
        if (!enabled || !stream) {
            updateScore("voice", 0)
            setStressLevel(0)
            setLabel("Calm")
            if (audioCtxRef.current) {
                audioCtxRef.current.close()
                audioCtxRef.current = null
                analyserRef.current = null
            }
            return
        }

        setupAudio(stream)
        intervalRef.current = setInterval(analyze, SAMPLE_RATE_MS)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            audioCtxRef.current?.close()
            audioCtxRef.current = null
            analyserRef.current = null
        }
    }, [enabled, stream, setupAudio, analyze, updateScore])

    return {
        currentPitch, pitchVariance, speechRate,
        voiceEnergy, stressLevel, isSpeaking,
        microTremorDetected, label,
    }
}
