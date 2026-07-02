/**
 * BayesianRiskEngine.ts
 * 
 * Session-aware Bayesian Belief Network that fuses all sensor signals into
 * a calibrated probability. Unlike a simple weighted average, Bayes:
 * - Carries a *session prior* that grows with each confirmed violation
 * - Produces a confidence estimate alongside the score
 * - Treats each sensor as an independent likelihood ratio
 */

export interface SensorReadings {
    deepfake: number    // 0–100
    voice: number       // 0–100
    facial: number      // 0–100
    behavioral: number  // 0–100
    keyword: number     // 0–100
    background: number  // 0–100
    // Additional ML signals
    lstmAnomaly?: number    // 0–100 from LSTM autoencoder
    isoForestAnomaly?: number // 0–100 from Isolation Forest
    hmmSuspicion?: number   // 0–100 from HMM state
}

// ── Likelihood Ratios (L.R.) ───────────────────────────────────────────────
// L.R. = P(signal_high | cheating) / P(signal_high | honest)
// Values > 1 mean the signal is more likely during cheating.
// Calibrated from empirical proctoring research literature.
const LIKELIHOOD_RATIOS: Record<keyof SensorReadings, { low: number; mid: number; high: number }> = {
    deepfake:         { low: 0.4,  mid: 1.5,  high: 12.0 },
    voice:            { low: 0.6,  mid: 1.2,  high: 6.0  },
    facial:           { low: 0.5,  mid: 1.3,  high: 8.0  },
    behavioral:       { low: 0.7,  mid: 1.4,  high: 5.0  },
    keyword:          { low: 0.8,  mid: 1.6,  high: 10.0 },
    background:       { low: 0.6,  mid: 1.1,  high: 4.0  },
    lstmAnomaly:      { low: 0.5,  mid: 2.0,  high: 15.0 },
    isoForestAnomaly: { low: 0.5,  mid: 1.8,  high: 10.0 },
    hmmSuspicion:     { low: 0.4,  mid: 2.5,  high: 20.0 },
}

// ── Session State ─────────────────────────────────────────────────────────
export class BayesianRiskEngine {
    /** Base prior: P(cheating) for a typical student in a controlled exam */
    private basePrior = 0.05

    /** Session prior — grows with violations, resets on session clear */
    private sessionPrior = 0.05

    /** Exponential moving average of posterior for smoothing */
    private ema = 0

    /** Confirmed violation count to update session prior */
    private violationCount = 0

    // ── Update session prior on confirmed violation ───────────────────────
    onViolation(severity: "LOW" | "MEDIUM" | "HIGH") {
        this.violationCount++
        const bump = severity === "HIGH" ? 0.12 : severity === "MEDIUM" ? 0.06 : 0.02
        this.sessionPrior = Math.min(0.95, this.sessionPrior + bump)
    }

    reset() {
        this.sessionPrior = this.basePrior
        this.violationCount = 0
        this.ema = 0
    }

    // ── Get likelihood ratio for a sensor value ───────────────────────────
    private getLR(key: keyof SensorReadings, value: number): number {
        const lr = LIKELIHOOD_RATIOS[key]
        if (value < 33) return lr.low
        if (value < 66) return lr.mid
        return lr.high
    }

    // ── Main Bayes update ─────────────────────────────────────────────────
    /**
     * Fuse all sensor signals via Bayes' theorem.
     * Returns { score: 0–100, confidence: 0–1, posterior: 0–1 }
     */
    predict(readings: SensorReadings): { score: number; confidence: number; posterior: number } {
        const prior = this.sessionPrior

        // Apply each sensor as a likelihood ratio update
        let oddsCheat = prior / (1 - prior)  // Convert to odds

        for (const [key, value] of Object.entries(readings) as [keyof SensorReadings, number][]) {
            if (value === undefined || value === null) continue
            const lr = this.getLR(key, value)
            oddsCheat *= lr  // Bayesian update: multiply odds by LR
        }

        // Convert back to probability
        const posterior = oddsCheat / (1 + oddsCheat)

        // EMA smoothing (α=0.3) — prevents wild swings from single-frame noise
        this.ema = 0.3 * posterior + 0.7 * this.ema

        const score = Math.min(100, Math.round(this.ema * 100))

        // Confidence = how far from the decision boundary (0.5 posterior)
        // High confidence when posterior is far from 0.5 in either direction
        const confidence = Math.abs(this.ema - 0.5) * 2  // 0–1

        return { score, confidence, posterior: this.ema }
    }

    getSessionPrior() { return this.sessionPrior }
    getViolationCount() { return this.violationCount }
}

// Singleton — one engine per browser session
export const bayesEngine = new BayesianRiskEngine()
