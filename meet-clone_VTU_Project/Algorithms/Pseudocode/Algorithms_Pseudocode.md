# Comprehensive Pseudocode of Application-Specific Algorithms
## Project: Online Video Meeting — A Step Towards Atma Nirbhar Bharat

---

### Algorithm 1: ARENA Predictive Congestion & Bitrate Scheduler
```
Algorithm ARENA_Congestion_Bitrate_Optimizer
Input:
    Sample: RTT (ms), Jitter (ms), PacketLoss (%)
    Context: isSpeaker (bool), headMovement (0-1), gazeConfidence (0-1)
Output:
    TargetBitrate (bps), Confidence (0-1)

Constants:
    WINDOW_SIZE = 10, THRESHOLD = 0.55
    W_D1 = 0.45, W_D2 = 0.35, W_JITTER = 0.20
    ALPHA = 0.15 (Bayesian Learning Rate), K = 0.25 (Exploration factor)

State:
    RttHistory = [], JitterHistory = []
    MeanBitrate = 2000000, Variance = 400000^2

Procedure Optimize(Sample, Context):
    1. Append Sample.RTT to RttHistory; Append Sample.Jitter to JitterHistory
    2. If Length(RttHistory) > WINDOW_SIZE:
           Shift(RttHistory); Shift(JitterHistory)
    3. If Length(RttHistory) < 3:
           Return (DefaultBitrate, 0.5)

    4. // Compute 1st order derivative (Velocity)
       d1 = Mean( RttHistory[i] - RttHistory[i-1] for i in last 5 )
    5. // Compute 2nd order derivative (Acceleration)
       d2 = Mean( d1[i] - d1[i-1] )
    6. // Compute Jitter derivative
       jitterTrend = Mean( JitterHistory[i] - JitterHistory[i-1] )

    7. normD1 = Clamp(d1 / 15.0, 0.0, 1.0)
    8. normD2 = Clamp(d2 / 5.0, 0.0, 1.0)
    9. normJitter = Clamp(jitterTrend / 5.0, 0.0, 1.0)

    10. rawSignal = (W_D1 * normD1) + (W_D2 * normD2) + (W_JITTER * normJitter)
    11. CongestionProb = 1.0 / (1.0 + Exp(-10.0 * (rawSignal - 0.5)))

    12. ContextScore = (0.40 * (Context.isSpeaker ? 1.0 : 0.2)) + 
                       (0.35 * Context.headMovement) + 
                       (0.25 * Context.gazeConfidence)

    13. Sigma = Sqrt(Variance)
    14. If Sample.PacketLoss > 10 Or Sample.RTT > 300:
            BaseBitrate = 450000
        Else If Sample.PacketLoss > 3 Or Sample.RTT > 150:
            BaseBitrate = 1200000
        Else:
            BaseBitrate = 2000000

    15. PredictiveReduction = (CongestionProb > THRESHOLD) ? (1.0 - 0.30 * CongestionProb) : 1.0
    16. ContextBoost = 1.0 + 0.45 * ContextScore
    17. NormalizedVariance = Sigma / 2000000.0
    18. ExplorationSign = (NormalizedVariance > 0.2) ? -1 : 1
    19. SampledBitrate = MeanBitrate + ExplorationSign * K * Sigma

    20. TargetBitrate = Round(0.5 * BaseBitrate * PredictiveReduction * ContextBoost + 
                             0.5 * SampledBitrate * PredictiveReduction)
    21. ClampedBitrate = Clamp(TargetBitrate, 80000, 4000000)

    22. // Online Bayesian Update
        Diff = ObservedActualBitrate - MeanBitrate
        MeanBitrate = MeanBitrate + ALPHA * Diff
        Variance = (1.0 - ALPHA) * (Variance + ALPHA * Diff * Diff)

    23. Return (ClampedBitrate, Max(0.0, 1.0 - NormalizedVariance))
```

---

### Algorithm 2: CHRONOS Cognitive Gap Engine
```
Algorithm CHRONOS_Cognitive_Gap
Input:
    GazeStream: Array of { yaw, pitch, blink, timestamp }
    HeadStream: Array of { x, y, z, timestamp }
    ExpectedComplexity: Float (0.0 to 1.0)
Output:
    MeasuredLoad, CognitiveGap, AICopilotDetected, Confidence

Constants:
    WINDOW_MS = 5000, BASE_BLINK_RATE = 15.0, ANOMALY_THRESHOLD = 0.55

Procedure Evaluate(GazeStream, HeadStream, ExpectedComplexity):
    1. Prune entries in GazeStream & HeadStream where (CurrentTime - timestamp > WINDOW_MS)
    2. If Length(GazeStream) < 10:
           Return (0.5, 0.0, FALSE, 0.1)

    3. // 1. Blink Rate Suppression
       BlinkCount = Count(g.blink == TRUE in GazeStream)
       ExtrapolatedBPM = (BlinkCount / WINDOW_MS) * 60000.0
       BlinkStrain = Max(0.0, 1.0 - (ExtrapolatedBPM / BASE_BLINK_RATE))

    4. // 2. Gaze Tunnel Vision (Spatial Variance)
       AvgYaw = Mean(g.yaw), AvgPitch = Mean(g.pitch)
       GazeVariance = Mean( (g.yaw - AvgYaw)^2 + (g.pitch - AvgPitch)^2 )
       GazeStrain = Max(0.0, 1.0 - (GazeVariance * 10.0))

    5. // 3. Head Micromovement Freezing
       AvgX = Mean(h.x)
       HeadVariance = Mean( (h.x - AvgX)^2 )
       HeadStrain = Max(0.0, 1.0 - (HeadVariance * 5.0))

    6. MeasuredLoad = (0.40 * BlinkStrain) + (0.40 * GazeStrain) + (0.20 * HeadStrain)
    7. CognitiveGap = Max(0.0, ExpectedComplexity - MeasuredLoad)

    8. AICopilotDetected = (CognitiveGap > ANOMALY_THRESHOLD)
    9. Confidence = Min(1.0, Length(GazeStream) / 50.0) * (CognitiveGap / ANOMALY_THRESHOLD)

    10. Return (MeasuredLoad, CognitiveGap, AICopilotDetected, Confidence)
```

---

### Algorithm 3: Behavioral 4-State HMM Viterbi Decoder
```
Algorithm Behavioral_4_State_HMM_Viterbi
Input:
    ObservationHistory: Array of discretized risk levels O_t in {0 (LOW), 1 (MED), 2 (HIGH)}
Output:
    CurrentBehavioralState in {FOCUSED, DISTRACTED, SUSPICIOUS, CHEATING}

Constants:
    States = [FOCUSED, DISTRACTED, SUSPICIOUS, CHEATING] (N = 4)
    PI = [0.90, 0.07, 0.02, 0.01]
    TransitionMatrix A = [
        [0.88, 0.09, 0.02, 0.01],
        [0.20, 0.65, 0.12, 0.03],
        [0.05, 0.20, 0.60, 0.15],
        [0.02, 0.08, 0.20, 0.70]
    ]
    EmissionMatrix B = [
        [0.85, 0.12, 0.03],
        [0.40, 0.45, 0.15],
        [0.10, 0.40, 0.50],
        [0.02, 0.15, 0.83]
    ]

Procedure Decode(ObservationHistory):
    1. T = Length(ObservationHistory)
    2. If T == 0: Return FOCUSED

    3. Initialize DP matrix dp[T][N] = -Infinity, Backpointer psi[T][N] = 0
    4. For i = 0 to N - 1:
           dp[0][i] = Ln(PI[i] + 1e-10) + Ln(B[i][ObservationHistory[0]] + 1e-10)

    5. For t = 1 to T - 1:
           For j = 0 to N - 1:
               BestVal = -Infinity, BestState = 0
               For i = 0 to N - 1:
                   Val = dp[t - 1][i] + Ln(A[i][j] + 1e-10)
                   If Val > BestVal:
                       BestVal = Val; BestState = i
               dp[t][j] = BestVal + Ln(B[j][ObservationHistory[t]] + 1e-10)
               psi[t][j] = BestState

    6. MaxVal = -Infinity, FinalState = 0
       For i = 0 to N - 1:
           If dp[T - 1][i] > MaxVal:
               MaxVal = dp[T - 1][i]; FinalState = i

    7. Return States[FinalState]
```
