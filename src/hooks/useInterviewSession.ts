"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewFlag {
    id: string
    timestamp: number
    type: "inconsistency" | "nervousness" | "avoidance" | "custom"
    note: string
    timeCode: string  // e.g. "04:32"
}

export interface InterviewNote {
    id: string
    text: string
    timestamp: number
    timeCode: string
}

export interface InterviewMetrics {
    eyeContactPercent: number    // 0-100 (from gaze hook)
    voiceStressLevel: number     // 0-100 (from stress hook)
    confidenceScore: number      // composite
    speakingTimeMs: number       // total time candidate spoke
    silencePeriods: number       // number of awkward silences >5s
    flags: InterviewFlag[]
}

export interface InterviewReportData {
    generatedAt: string
    interviewDurationMs: number
    interviewDurationFormatted: string
    metrics: InterviewMetrics
    flags: InterviewFlag[]
    notes: InterviewNote[]
    summary: {
        overallRating: "Excellent" | "Good" | "Fair" | "Poor"
        eyeContactAssessment: string
        stressAssessment: string
        confidenceAssessment: string
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Options
// ─────────────────────────────────────────────────────────────────────────────

interface UseInterviewSessionOptions {
    socket: unknown | null
    userId: string
    isHost: boolean
    eyeContactScore?: number   // 0-100, from useGazeTracking
    stressLevel?: number       // 0-100, from useStressVoiceDetection
    isSpeaking?: boolean       // from VAD hook
    emotions?: { joy: number; anger: number; sadness: number; fear: number; surprise: number; disgust: number }
    semanticFraudIntent?: number // 0-1
}

interface UseInterviewSessionReturn {
    metrics: InterviewMetrics
    flags: InterviewFlag[]
    notes: InterviewNote[]
    interviewDuration: number   // ms since session started
    addFlag: (type: InterviewFlag["type"], note: string) => void
    addNote: (text: string) => void
    removeFlag: (id: string) => void
    removeNote: (id: string) => void
    getReportData: () => InterviewReportData
    resetSession: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SILENCE_THRESHOLD_MS = 5000      // Awkward silence if quiet > 5s
const DEMO_UPDATE_INTERVAL_MS = 2000   // Demo mode tick

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTimeCode(elapsedMs: number): string {
    const totalSec = Math.floor(elapsedMs / 1000)
    const minutes  = Math.floor(totalSec / 60)
    const seconds  = totalSec % 60
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

function computeConfidence(eyeContact: number, stress: number): number {
    const raw = eyeContact * 0.4 + (100 - stress) * 0.4 + 20
    return Math.max(0, Math.min(100, Math.round(raw)))
}

function nanoid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function ratingFromScore(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
    if (score >= 80) return "Excellent"
    if (score >= 60) return "Good"
    if (score >= 40) return "Fair"
    return "Poor"
}

function assessEyeContact(pct: number): string {
    if (pct >= 75) return "Excellent eye contact — candidate appears confident and engaged."
    if (pct >= 50) return "Moderate eye contact — occasional breaks from the camera."
    if (pct >= 25) return "Below-average eye contact — candidate may be nervous or distracted."
    return "Poor eye contact — consistent avoidance noticed throughout the session."
}

function assessStress(level: number): string {
    if (level <= 25) return "Voice stress is low — candidate sounds calm and composed."
    if (level <= 50) return "Moderate voice stress detected — some tension in speech patterns."
    if (level <= 75) return "Elevated stress levels — noticeable vocal tremors or rapid speech."
    return "High stress throughout — candidate may be significantly anxious."
}

function assessConfidence(score: number): string {
    if (score >= 80) return "High overall confidence — strong verbal and non-verbal presence."
    if (score >= 60) return "Good confidence — minor signs of hesitation at times."
    if (score >= 40) return "Fair confidence — frequent hesitation or uncertainty observed."
    return "Low confidence indicators — candidate struggled to project assurance."
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo mode simulator — gentle random walk
// ─────────────────────────────────────────────────────────────────────────────

function demoWalk(current: number, min: number, max: number, step: number): number {
    const delta = (Math.random() - 0.5) * step * 2
    return Math.max(min, Math.min(max, Math.round(current + delta)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useInterviewSession({
    socket,
    userId,
    isHost,
    eyeContactScore = 70,
    stressLevel = 30,
    isSpeaking = false,
    emotions,
    semanticFraudIntent,
}: UseInterviewSessionOptions): UseInterviewSessionReturn {

    const sessionStartRef   = useRef<number>(Date.now())
    const isDemo            = socket === null

    // ── Core metric state ──────────────────────────────────────────────────
    const [eyeContact, setEyeContact] = useState<number>(eyeContactScore)
    const [stress,     setStress]     = useState<number>(stressLevel)
    const [confidence, setConfidence] = useState<number>(() => computeConfidence(eyeContactScore, stressLevel))

    // ── Speaking time ──────────────────────────────────────────────────────
    const [speakingTimeMs,  setSpeakingTimeMs]  = useState<number>(0)
    const [silencePeriods,  setSilencePeriods]  = useState<number>(0)
    const speakingStartRef  = useRef<number | null>(null)
    const lastSpeakTimeRef  = useRef<number>(Date.now())
    const silenceTrackedRef = useRef<boolean>(false)

    // ── Duration timer ─────────────────────────────────────────────────────
    const [interviewDuration, setInterviewDuration] = useState<number>(0)

    // ── Flags & Notes ──────────────────────────────────────────────────────
    const [flags, setFlags] = useState<InterviewFlag[]>([])
    const [notes, setNotes] = useState<InterviewNote[]>([])

    // ── Demo state ─────────────────────────────────────────────────────────
    const demoEyeRef    = useRef<number>(eyeContactScore)
    const demoStressRef = useRef<number>(stressLevel)

    // Duration ticker (1s)
    useEffect(() => {
        const tick = setInterval(() => {
            setInterviewDuration(Date.now() - sessionStartRef.current)
        }, 1000)
        return () => clearInterval(tick)
    }, [])

    // Live mode: sync props into state + recompute confidence
    useEffect(() => {
        if (isDemo) return
        setEyeContact(eyeContactScore)
        setStress(stressLevel)
        setConfidence(computeConfidence(eyeContactScore, stressLevel))
    }, [isDemo, eyeContactScore, stressLevel])



    // Demo mode: slow random walk for metrics
    useEffect(() => {
        if (!isDemo) return

        const tick = setInterval(() => {
            demoEyeRef.current    = demoWalk(demoEyeRef.current,    30, 95, 6)
            demoStressRef.current = demoWalk(demoStressRef.current, 10, 70, 5)
            setEyeContact(demoEyeRef.current)
            setStress(demoStressRef.current)
            setConfidence(computeConfidence(demoEyeRef.current, demoStressRef.current))
        }, DEMO_UPDATE_INTERVAL_MS)

        return () => clearInterval(tick)
    }, [isDemo])

    // Speaking time tracking
    useEffect(() => {
        const now = Date.now()

        if (isSpeaking) {
            if (speakingStartRef.current === null) {
                speakingStartRef.current = now
            }
            const silenceGap = now - lastSpeakTimeRef.current
            if (!silenceTrackedRef.current && silenceGap > SILENCE_THRESHOLD_MS) {
                setSilencePeriods(prev => prev + 1)
            }
            silenceTrackedRef.current = false
            lastSpeakTimeRef.current  = now
        } else {
            if (speakingStartRef.current !== null) {
                const elapsed = now - speakingStartRef.current
                setSpeakingTimeMs(prev => prev + elapsed)
                speakingStartRef.current = null
            }
            silenceTrackedRef.current = true
        }
    }, [isSpeaking])

    // Demo: simulate speaking time accumulation
    useEffect(() => {
        if (!isDemo) return
        const tick = setInterval(() => {
            setSpeakingTimeMs(prev => prev + (Math.random() > 0.4 ? 2000 : 0))
        }, 2000)
        return () => clearInterval(tick)
    }, [isDemo])

    // ── addFlag ────────────────────────────────────────────────────────────
    const addFlag = useCallback((type: InterviewFlag["type"], note: string) => {
        const elapsed  = Date.now() - sessionStartRef.current
        const timeCode = formatTimeCode(elapsed)
        const flag: InterviewFlag = {
            id:        nanoid(),
            timestamp: Date.now(),
            type,
            note:      note.trim() || defaultFlagNote(type),
            timeCode,
        }
        setFlags(prev => [flag, ...prev])

        if (!isDemo && socket) {
            try {
                (socket as { emit: (event: string, data: unknown) => void })
                    .emit("interview:flag", { userId, flag })
            } catch { /* socket may not support emit */ }
        }
    }, [isDemo, socket, userId])

    // Auto-flagging for Semantic AI & Emotion Matrix
    const lastFlagTimeRef = useRef<number>(0)
    useEffect(() => {
        if (isDemo) return
        const now = Date.now()
        if (now - lastFlagTimeRef.current < 15000) return // Throttle auto-flags

        if (semanticFraudIntent && semanticFraudIntent > 0.6) {
            addFlag("custom", `High semantic fraud intent detected (${Math.round(semanticFraudIntent * 100)}%)`)
            lastFlagTimeRef.current = now
        }
        if (emotions?.fear && emotions.fear > 0.8) {
            addFlag("nervousness", `Extreme fear emotion detected (${Math.round(emotions.fear * 100)}%)`)
            lastFlagTimeRef.current = now
        }
    }, [semanticFraudIntent, emotions, isDemo, addFlag])

    // ── addNote ────────────────────────────────────────────────────────────
    const addNote = useCallback((text: string) => {
        if (!text.trim()) return
        const elapsed  = Date.now() - sessionStartRef.current
        const timeCode = formatTimeCode(elapsed)
        const note: InterviewNote = {
            id:        nanoid(),
            text:      text.trim(),
            timestamp: Date.now(),
            timeCode,
        }
        setNotes(prev => [note, ...prev])
    }, [])

    // ── removeFlag / removeNote ────────────────────────────────────────────
    const removeFlag = useCallback((id: string) => {
        setFlags(prev => prev.filter(f => f.id !== id))
    }, [])

    const removeNote = useCallback((id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id))
    }, [])

    // ── getReportData ──────────────────────────────────────────────────────
    const getReportData = useCallback((): InterviewReportData => {
        const durationMs = Date.now() - sessionStartRef.current
        const metrics: InterviewMetrics = {
            eyeContactPercent: eyeContact,
            voiceStressLevel:  stress,
            confidenceScore:   confidence,
            speakingTimeMs,
            silencePeriods,
            flags,
        }
        return {
            generatedAt:                new Date().toISOString(),
            interviewDurationMs:        durationMs,
            interviewDurationFormatted: formatDuration(durationMs),
            metrics,
            flags,
            notes,
            summary: {
                overallRating:        ratingFromScore(confidence),
                eyeContactAssessment: assessEyeContact(eyeContact),
                stressAssessment:     assessStress(stress),
                confidenceAssessment: assessConfidence(confidence),
            },
        }
    }, [eyeContact, stress, confidence, speakingTimeMs, silencePeriods, flags, notes])

    // ── resetSession ───────────────────────────────────────────────────────
    const resetSession = useCallback(() => {
        sessionStartRef.current  = Date.now()
        speakingStartRef.current = null
        lastSpeakTimeRef.current = Date.now()
        setSpeakingTimeMs(0)
        setSilencePeriods(0)
        setFlags([])
        setNotes([])
        setInterviewDuration(0)
    }, [])

    const metrics: InterviewMetrics = {
        eyeContactPercent: eyeContact,
        voiceStressLevel:  stress,
        confidenceScore:   confidence,
        speakingTimeMs,
        silencePeriods,
        flags,
    }

    return {
        metrics,
        flags,
        notes,
        interviewDuration,
        addFlag,
        addNote,
        removeFlag,
        removeNote,
        getReportData,
        resetSession,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────────────────────

function defaultFlagNote(type: InterviewFlag["type"]): string {
    switch (type) {
        case "inconsistency": return "Candidate's answer conflicts with earlier statement."
        case "nervousness":   return "Visible signs of anxiety detected."
        case "avoidance":     return "Candidate deflected the question."
        case "custom":        return "Manual observation."
    }
}
