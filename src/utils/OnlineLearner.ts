/**
 * OnlineLearner.ts
 *
 * Stochastic Gradient Descent weight adapter.
 * When a violation is CONFIRMED (strike issued), this class backpropagates:
 * signals that were elevated at the time of violation get their weights increased.
 *
 * After ~10+ confirmed events, the weights converge to reflect which signals
 * actually matter for THIS student's cheating pattern.
 *
 * Persists learned weights to localStorage so knowledge survives page reloads.
 */

export type SignalKey = 'deepfake' | 'voice' | 'facial' | 'behavioral' | 'keyword' | 'background'

const STORAGE_KEY = 'meet-clone:online-learner-weights'
const LEARNING_RATE = 0.015  // η — small to prevent oscillation
const MOMENTUM = 0.85        // Nesterov momentum coefficient

// Default weights (sum to 1.0 — equal start)
const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
    deepfake: 0.25,
    facial:   0.20,
    voice:    0.20,
    behavioral: 0.15,
    keyword:  0.10,
    background: 0.10,
}

export class OnlineLearner {
    private weights: Record<SignalKey, number>
    private velocity: Record<SignalKey, number>   // Momentum term
    private updateCount = 0
    private lossHistory: number[] = []

    constructor() {
        this.weights = this.loadWeights()
        this.velocity = Object.fromEntries(
            Object.keys(DEFAULT_WEIGHTS).map(k => [k, 0])
        ) as Record<SignalKey, number>
    }

    // ── Load from localStorage ────────────────────────────────────────────
    private loadWeights(): Record<SignalKey, number> {
        try {
            if (typeof window === 'undefined') return { ...DEFAULT_WEIGHTS }
            const stored = localStorage.getItem(STORAGE_KEY)
            if (!stored) return { ...DEFAULT_WEIGHTS }
            const parsed = JSON.parse(stored)
            // Validate all keys present
            const allKeys = Object.keys(DEFAULT_WEIGHTS) as SignalKey[]
            if (allKeys.every(k => typeof parsed[k] === 'number')) return parsed
        } catch { /* ignore */ }
        return { ...DEFAULT_WEIGHTS }
    }

    // ── Save to localStorage ──────────────────────────────────────────────
    private saveWeights() {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.weights))
            }
        } catch { /* ignore */ }
    }

    // ── Predict: weighted sum of signals (0–100) ──────────────────────────
    predict(signals: Record<SignalKey, number>): number {
        let sum = 0
        for (const [key, w] of Object.entries(this.weights) as [SignalKey, number][]) {
            sum += w * (signals[key] ?? 0)
        }
        return Math.min(100, Math.max(0, Math.round(sum)))
    }

    // ── Update weights on confirmed violation ─────────────────────────────
    /**
     * Call this when a strike is issued. The target is the desired output (100).
     * The current signals at the time of violation are the training features.
     */
    update(signals: Record<SignalKey, number>, violationSeverity: "LOW" | "MEDIUM" | "HIGH") {
        const target = violationSeverity === "HIGH" ? 95 : violationSeverity === "MEDIUM" ? 75 : 55
        const prediction = this.predict(signals)
        const error = (target - prediction) / 100  // Normalize

        // SGD with Nesterov momentum
        for (const key of Object.keys(this.weights) as SignalKey[]) {
            const gradient = error * (signals[key] ?? 0) / 100

            // Momentum update: velocity = momentum * velocity + gradient
            this.velocity[key] = MOMENTUM * this.velocity[key] + gradient

            // Weight update with Nesterov lookahead
            this.weights[key] += LEARNING_RATE * (MOMENTUM * this.velocity[key] + gradient)

            // Clamp weights to sensible range [0.02, 0.6]
            this.weights[key] = Math.max(0.02, Math.min(0.60, this.weights[key]))
        }

        // Re-normalize weights to sum to ~1.0
        const total = Object.values(this.weights).reduce((a, b) => a + b, 0)
        for (const key of Object.keys(this.weights) as SignalKey[]) {
            this.weights[key] /= total
        }

        // Track loss for analytics
        const loss = Math.pow(error, 2)
        this.lossHistory.push(loss)
        if (this.lossHistory.length > 50) this.lossHistory.shift()

        this.updateCount++
        this.saveWeights()
    }

    // ── Analytics ─────────────────────────────────────────────────────────
    get currentWeights(): Record<SignalKey, number> { return { ...this.weights } }
    get updates(): number { return this.updateCount }
    get recentLoss(): number {
        if (!this.lossHistory.length) return 0
        return this.lossHistory.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, this.lossHistory.length)
    }

    // ── Sorted weights for display (most important first) ─────────────────
    get rankedSignals(): { signal: SignalKey; weight: number; rank: number }[] {
        return (Object.entries(this.weights) as [SignalKey, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([signal, weight], i) => ({ signal, weight, rank: i + 1 }))
    }

    resetWeights() {
        this.weights = { ...DEFAULT_WEIGHTS }
        this.velocity = Object.fromEntries(
            Object.keys(DEFAULT_WEIGHTS).map(k => [k, 0])
        ) as Record<SignalKey, number>
        this.updateCount = 0
        this.lossHistory = []
        this.saveWeights()
    }
}

export const onlineLearner = new OnlineLearner()
