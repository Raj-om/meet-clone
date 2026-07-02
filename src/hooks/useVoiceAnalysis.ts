"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { ScamSignal } from "./useScamDetection"

// ── Scam keyword list ──────────────────────────────────────────────────────────
const SCAM_KEYWORDS: { phrase: string; weight: number }[] = [
    // ── Urgent / Pressure Tactics ──
    { phrase: "act now", weight: 10 },
    { phrase: "urgent", weight: 8 },
    { phrase: "limited time", weight: 9 },
    { phrase: "don't hang up", weight: 10 },
    { phrase: "keep this private", weight: 11 },
    { phrase: "do not tell", weight: 11 },

    // ── Financial / Payment ──
    { phrase: "wire transfer", weight: 12 },
    { phrase: "gift card", weight: 12 },
    { phrase: "bank account", weight: 7 },
    { phrase: "credit card number", weight: 9 },
    { phrase: "routing number", weight: 9 },
    { phrase: "crypto", weight: 6 },
    { phrase: "bitcoin", weight: 7 },
    { phrase: "invest now", weight: 8 },
    { phrase: "guaranteed return", weight: 7 },
    { phrase: "refund", weight: 6 },
    { phrase: "prize", weight: 7 },

    // ── Account / Security ──
    { phrase: "verify your account", weight: 10 },
    { phrase: "click the link", weight: 8 },
    { phrase: "password", weight: 8 },
    { phrase: "suspended", weight: 7 },
    { phrase: "compromised", weight: 8 },
    { phrase: "unauthorized access", weight: 9 },
    { phrase: "security breach", weight: 8 },

    // ── Authority Impersonation (Fake Police / Gov / IRS) ──
    { phrase: "irs", weight: 10 },
    { phrase: "internal revenue service", weight: 10 },
    { phrase: "police", weight: 9 },
    { phrase: "law enforcement", weight: 9 },
    { phrase: "fbi", weight: 10 },
    { phrase: "customs and border", weight: 9 },
    { phrase: "social security", weight: 10 },
    { phrase: "medicare", weight: 8 },
    { phrase: "arrest", weight: 11 },
    { phrase: "warrant", weight: 11 },
    { phrase: "under investigation", weight: 10 },
    { phrase: "legal action", weight: 9 },
    { phrase: "courthouse", weight: 8 },
    { phrase: "badge number", weight: 9 },
    { phrase: "officer", weight: 7 },
    { phrase: "pay a fine", weight: 12 },
    { phrase: "jail time", weight: 11 },
    { phrase: "frozen account", weight: 10 },
]

// High speech rate threshold: > 3 words per second = pressure tactic
const HIGH_SPEECH_RATE_WPS = 3.0

interface UseVoiceAnalysisOptions {
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
}

interface VoiceAnalysisResult {
    transcript: string
    detectedKeywords: string[]
    speechRate: number  // words per second
    voiceScore: number
    keywordScore: number
    isListening: boolean
}

export function useVoiceAnalysis({ enabled, updateScore }: UseVoiceAnalysisOptions): VoiceAnalysisResult {
    const [transcript, setTranscript] = useState("")
    const [detectedKeywords, setDetectedKeywords] = useState<string[]>([])
    const [speechRate, setSpeechRate] = useState(0)
    const [voiceScore, setVoiceScore] = useState(0)
    const [keywordScore, setKeywordScore] = useState(0)
    const [isListening, setIsListening] = useState(false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null)
    const windowStartRef = useRef<number>(Date.now())
    const windowWordsRef = useRef<number>(0)
    const cumulativeWeightRef = useRef<number>(0)
    const lastPhraseRef = useRef<string>("")

    const calcKeywordScore = useCallback((text: string): { score: number; found: string[] } => {
        const lower = text.toLowerCase()
        let totalWeight = 0
        const found: string[] = []
        for (const { phrase, weight } of SCAM_KEYWORDS) {
            if (lower.includes(phrase)) {
                totalWeight += weight
                if (!found.includes(phrase)) found.push(phrase)
            }
        }
        // Cap at 100
        return { score: Math.min(100, totalWeight * 5), found }
    }, [])

    const resetWindow = useCallback(() => {
        windowStartRef.current = Date.now()
        windowWordsRef.current = 0
        cumulativeWeightRef.current = 0
        lastPhraseRef.current = ""
    }, [])

    useEffect(() => {
        if (!enabled) {
            updateScore("voice", 0)
            updateScore("keyword", 0)
            setIsListening(false)
            recognitionRef.current?.stop()
            return
        }

        const SpeechRecognition =
            (typeof window !== "undefined" &&
                ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null

        if (!SpeechRecognition) {
            console.warn("[useVoiceAnalysis] SpeechRecognition not supported in this browser.")
            return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SpeechRecognition() as any
        recognition.lang = "en-US"
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1
        recognitionRef.current = recognition

        resetWindow()

        recognition.onstart = () => setIsListening(true)
        recognition.onend = () => {
            setIsListening(false)
            // Auto-restart if still enabled
            if (enabled) {
                try { recognition.start() } catch { /* already running */ }
            }
        }

        recognition.onresult = (event: any) => {
            let finalText = ""
            let interimText = ""

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i]
                if (res.isFinal) finalText += res[0].transcript + " "
                else interimText += res[0].transcript
            }

            // ── Keyword detection on interim + final (lower latency) ──
            const fullPhrase = (finalText + interimText).trim()
            if (fullPhrase && fullPhrase !== lastPhraseRef.current) {
                lastPhraseRef.current = fullPhrase
                const { score, found } = calcKeywordScore(fullPhrase)

                if (found.length > 0) {
                    cumulativeWeightRef.current = Math.min(100, cumulativeWeightRef.current + score * 0.4)
                }
                setDetectedKeywords(found)
                setKeywordScore(cumulativeWeightRef.current)
                updateScore("keyword", cumulativeWeightRef.current)
            }

            // ── Speech rate (words per second over rolling 30 s window) ──
            if (finalText) {
                const words = finalText.trim().split(/\s+/).filter(Boolean).length
                windowWordsRef.current += words
                setTranscript(prev => (prev + " " + finalText).trim().slice(-1000))

                const elapsed = (Date.now() - windowStartRef.current) / 1000
                if (elapsed >= 5) {  // recalculate every 5 s
                    const wps = windowWordsRef.current / elapsed
                    setSpeechRate(wps)

                    // High speech rate = pressure, score 0-60 on top of keyword score
                    const rateScore = wps >= HIGH_SPEECH_RATE_WPS
                        ? Math.min(60, Math.round((wps - HIGH_SPEECH_RATE_WPS) * 25))
                        : 0

                    const combined = Math.min(100, cumulativeWeightRef.current + rateScore)
                    setVoiceScore(combined)
                    updateScore("voice", combined)

                    // Reset window
                    if (elapsed >= 30) resetWindow()
                }
            }
        }

        recognition.onerror = (e: any) => {
            if (e.error !== "no-speech") console.warn("[useVoiceAnalysis] error:", e.error)
        }

        try { recognition.start() } catch { /* already started */ }

        return () => {
            recognition.onend = null
            recognition.stop()
            setIsListening(false)
        }
    }, [enabled, updateScore, calcKeywordScore, resetWindow])

    return { transcript, detectedKeywords, speechRate, voiceScore, keywordScore, isListening }
}
