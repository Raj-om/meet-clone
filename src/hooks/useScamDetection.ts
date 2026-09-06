"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { bayesEngine, SensorReadings } from "@/utils/BayesianRiskEngine"
import { examHMM, HMMState } from "@/utils/HiddenMarkovModel"
import { examIsolationForest, IFFeatureVector } from "@/utils/IsolationForest"
import { onlineLearner, SignalKey } from "@/utils/OnlineLearner"

export type ScamSignal = 'facial' | 'voice' | 'background' | 'behavioral' | 'keyword' | 'deepfake'

export interface SignalScores {
    facial: number
    voice: number
    background: number
    behavioral: number
    keyword: number
    deepfake: number
}

export interface AlertEvent {
    timestamp: number
    riskScore: number
    triggeredSignals: ScamSignal[]
    participantId: string
}

export interface MLInsights {
    bayesScore: number          // Calibrated Bayes posterior (0–100)
    confidence: number          // How certain the model is (0–1)
    hmmState: HMMState          // FOCUSED / DISTRACTED / SUSPICIOUS / CHEATING
    hmmSuspicion: number        // 0–100 from HMM
    isoForestAnomaly: number    // 0–100 from Isolation Forest
    learnedWeights: Record<SignalKey, number>  // SGD-updated signal weights
    onlineLearnScore: number    // 0–100 from OnlineLearner weighted sum
    sessionPrior: number        // Bayes session prior (grows with violations)
    violationsUsedForLearning: number
    lstmAnomaly?: number        // 0–100 from LSTM (if active)
}

const ALERT_THRESHOLD = 70
const ISO_FOREST_BASELINE_FRAMES = 50  // frames before IsoForest can score

// ── Isolation Forest baseline collection ──────────────────────────────────
let isoBaselineBuffer: IFFeatureVector[] = []
let isoTrained = false

function updateIsoForest(scores: SignalScores, lstmAnomaly = 0): number {
    const vec: IFFeatureVector = {
        deepfake: scores.deepfake,
        voice: scores.voice,
        facial: scores.facial,
        behavioral: scores.behavioral,
        keyword: scores.keyword,
        lstmAnomaly,
    }
    if (!isoTrained) {
        isoBaselineBuffer.push(vec)
        if (isoBaselineBuffer.length >= ISO_FOREST_BASELINE_FRAMES) {
            examIsolationForest.fit(isoBaselineBuffer)
            isoTrained = true
        }
        return 0
    }
    return examIsolationForest.score(vec)
}

function getTriggeredSignals(scores: SignalScores): ScamSignal[] {
    return (Object.keys(scores) as ScamSignal[]).filter(k => scores[k] > 50)
}

export function useScamDetection(participantId: string, enabled: boolean = true) {
    const [scores, setScores] = useState<SignalScores>({
        facial: 0, voice: 0, background: 0, behavioral: 0, keyword: 0, deepfake: 0,
    })
    const [riskScore, setRiskScore] = useState(0)
    const [alertHistory, setAlertHistory] = useState<AlertEvent[]>([])
    const [isEnabled, setIsEnabled] = useState(true)
    const [mlInsights, setMlInsights] = useState<MLInsights>({
        bayesScore: 0, confidence: 0,
        hmmState: "FOCUSED", hmmSuspicion: 5, isoForestAnomaly: 0,
        learnedWeights: onlineLearner.currentWeights,
        onlineLearnScore: 0, sessionPrior: 0.05, violationsUsedForLearning: 0,
    })

    const lastAlertRef = useRef<number>(0)
    const lstmAnomalyRef = useRef(0)

    // ── Called by LSTM hook to feed anomaly score into the engine ────────────
    const updateLSTMAnomaly = useCallback((score: number) => {
        lstmAnomalyRef.current = score
    }, [])

    // ── Main score updater (called by every sensor hook) ─────────────────────
    const updateScore = useCallback((signal: ScamSignal, value: number) => {
        if (!enabled || !isEnabled) return
        setScores(prev => ({
            ...prev,
            [signal]: Math.max(0, Math.min(100, value))
        }))
    }, [enabled, isEnabled])

    useEffect(() => {
        if (!enabled || !isEnabled) return

        // ── 1. Online Learner (SGD weights) ───────────────────────────
        const olScore = onlineLearner.predict(scores as unknown as Record<SignalKey, number>)

        // ── 2. Isolation Forest (anomaly detection) ───────────────────
        const isoScore = updateIsoForest(scores, lstmAnomalyRef.current)

        // ── 3. HMM — feed Bayes score, get state trajectory ──────────
        const sensorReadings: SensorReadings = {
            ...scores,
            lstmAnomaly: lstmAnomalyRef.current,
            isoForestAnomaly: isoScore,
        }
        const { score: bayesScore, confidence, posterior } = bayesEngine.predict(sensorReadings)
        const hmmState = examHMM.observe(bayesScore)

        // ── 4. Final ensemble: Bayes + HMM + IsoForest ────────────────
        const hmmBoost = examHMM.suspicionScore  // 5 / 35 / 65 / 90
        const ensembleRaw =
            0.50 * bayesScore +
            0.25 * hmmBoost +
            0.15 * isoScore +
            0.10 * olScore
        const finalScore = Math.min(100, Math.round(ensembleRaw))

        setRiskScore(finalScore)

        setMlInsights({
            bayesScore,
            confidence,
            hmmState,
            hmmSuspicion: hmmBoost,
            isoForestAnomaly: isoScore,
            learnedWeights: onlineLearner.currentWeights,
            onlineLearnScore: olScore,
            sessionPrior: Math.round(bayesEngine.getSessionPrior() * 100) / 100,
            violationsUsedForLearning: onlineLearner.updates,
            lstmAnomaly: lstmAnomalyRef.current,
        })

        const now = Date.now()
        if (finalScore >= ALERT_THRESHOLD && now - lastAlertRef.current > 10_000) {
            lastAlertRef.current = now
            const triggered = Object.entries(scores).filter(([, v]) => v > 50).map(([k]) => k as ScamSignal)
            const event: AlertEvent = {
                timestamp: now,
                riskScore: finalScore,
                triggeredSignals: triggered,
                participantId,
            }
            setAlertHistory(h => [event, ...h].slice(0, 20))
        }
    }, [scores, enabled, isEnabled, participantId])

    // ── Called when a violation is confirmed (strike issued) ─────────────────
    const onConfirmedViolation = useCallback((severity: "LOW" | "MEDIUM" | "HIGH") => {
        // 1. Update Bayes session prior
        bayesEngine.onViolation(severity)
        // 2. Escalate HMM state
        examHMM.forceEscalate()
        // 3. Update Online Learner (backprop through signal weights)
        onlineLearner.update(scores as unknown as Record<SignalKey, number>, severity)
    }, [scores])

    const resetScores = useCallback(() => {
        setScores({ facial: 0, voice: 0, background: 0, behavioral: 0, keyword: 0, deepfake: 0 })
        setRiskScore(0)
        bayesEngine.reset()
        examHMM.reset()
        isoBaselineBuffer = []
        isoTrained = false
    }, [])

    const isHighRisk = riskScore >= ALERT_THRESHOLD
    const isMediumRisk = riskScore >= 40 && riskScore < ALERT_THRESHOLD

    return {
        scores, riskScore, isHighRisk, isMediumRisk,
        alertHistory, isEnabled, setIsEnabled,
        updateScore, resetScores,
        mlInsights, updateLSTMAnomaly, onConfirmedViolation,
        ALERT_THRESHOLD,
    }
}
