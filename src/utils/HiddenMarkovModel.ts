/**
 * HiddenMarkovModel.ts
 *
 * 4-state HMM that models the *trajectory* of student behavior during an exam.
 * Instead of asking "what is happening NOW?", it asks:
 * "Given everything that happened in the last 20 seconds, what behavioral
 * STATE is this student most likely in?"
 *
 * States: FOCUSED → DISTRACTED → SUSPICIOUS → CHEATING
 *
 * Uses the Viterbi algorithm to find the maximum-probability state sequence.
 */

export type HMMState = "FOCUSED" | "DISTRACTED" | "SUSPICIOUS" | "CHEATING"

const STATES: HMMState[] = ["FOCUSED", "DISTRACTED", "SUSPICIOUS", "CHEATING"]

// ── Transition Probabilities A[i][j] = P(state_j | state_i) ──────────────
// Each row sums to 1.0
// Modeled to be: mostly sticky (students stay in state), slow escalation
const A: number[][] = [
    // FROM FOCUSED:
    [0.88, 0.09, 0.02, 0.01],
    // FROM DISTRACTED:
    [0.20, 0.65, 0.12, 0.03],
    // FROM SUSPICIOUS:
    [0.05, 0.20, 0.60, 0.15],
    // FROM CHEATING:
    [0.02, 0.08, 0.20, 0.70],
]

// ── Emission Probabilities B[state][obs_level] ────────────────────────────
// Observation is discretized risk score: LOW(<33), MED(33–66), HIGH(>66)
// B[i][j] = P(obs_j | state_i)
const B: number[][] = [
    // FOCUSED     →  P(LOW), P(MED), P(HIGH)
    [0.85,  0.12,  0.03],
    // DISTRACTED  →
    [0.40,  0.45,  0.15],
    // SUSPICIOUS  →
    [0.10,  0.40,  0.50],
    // CHEATING    →
    [0.02,  0.15,  0.83],
]

// ── Initial State Distribution π ─────────────────────────────────────────
const PI = [0.90, 0.07, 0.02, 0.01]

export class HiddenMarkovModel {
    private observations: number[] = []       // Rolling history of discretized obs
    private currentState: HMMState = "FOCUSED"
    private stateDurations: Record<HMMState, number> = {
        FOCUSED: 0, DISTRACTED: 0, SUSPICIOUS: 0, CHEATING: 0
    }

    // ── Discretize a 0–100 score into obs level 0/1/2 ────────────────────
    private discretize(score: number): number {
        if (score < 33) return 0
        if (score < 66) return 1
        return 2
    }

    // ── Viterbi algorithm ─────────────────────────────────────────────────
    private viterbi(obs: number[]): HMMState {
        if (obs.length === 0) return "FOCUSED"

        const N = STATES.length
        const T = obs.length

        // dp[t][i] = max log-prob of any path ending in state i at time t
        const dp: number[][] = Array.from({ length: T }, () => new Array(N).fill(-Infinity))
        const psi: number[][] = Array.from({ length: T }, () => new Array(N).fill(0))

        // Initialize
        for (let i = 0; i < N; i++) {
            dp[0][i] = Math.log(PI[i] + 1e-10) + Math.log(B[i][obs[0]] + 1e-10)
        }

        // Recurse
        for (let t = 1; t < T; t++) {
            for (let j = 0; j < N; j++) {
                let best = -Infinity
                let bestState = 0
                for (let i = 0; i < N; i++) {
                    const val = dp[t - 1][i] + Math.log(A[i][j] + 1e-10)
                    if (val > best) { best = val; bestState = i }
                }
                dp[t][j] = best + Math.log(B[j][obs[t]] + 1e-10)
                psi[t][j] = bestState
            }
        }

        // Backtrack from final time step
        let finalState = 0
        let maxVal = -Infinity
        for (let i = 0; i < N; i++) {
            if (dp[T - 1][i] > maxVal) { maxVal = dp[T - 1][i]; finalState = i }
        }

        return STATES[finalState]
    }

    // ── Public API ────────────────────────────────────────────────────────

    /** Feed a new Bayesian risk score (0–100) into the HMM */
    observe(riskScore: number): HMMState {
        const obs = this.discretize(riskScore)
        this.observations.push(obs)

        // Keep a 20-observation sliding window (20s @ 1 obs/sec)
        if (this.observations.length > 20) this.observations.shift()

        const newState = this.viterbi(this.observations)

        // Track duration in each state for analytics
        if (newState === this.currentState) {
            this.stateDurations[newState]++
        } else {
            this.currentState = newState
        }

        return newState
    }

    /** Current decoded state */
    get state(): HMMState { return this.currentState }

    /** How many ticks the model has been in each state */
    get durations() { return { ...this.stateDurations } }

    /** 0–100 suspicion score derived from the current state */
    get suspicionScore(): number {
        switch (this.currentState) {
            case "FOCUSED":    return 5
            case "DISTRACTED": return 35
            case "SUSPICIOUS": return 65
            case "CHEATING":   return 90
        }
    }

    /** Manually escalate (e.g. on confirmed violation) */
    forceEscalate() {
        const idx = STATES.indexOf(this.currentState)
        if (idx < STATES.length - 1) {
            this.currentState = STATES[idx + 1]
        }
    }

    reset() {
        this.observations = []
        this.currentState = "FOCUSED"
        this.stateDurations = { FOCUSED: 0, DISTRACTED: 0, SUSPICIOUS: 0, CHEATING: 0 }
    }
}

export const examHMM = new HiddenMarkovModel()
