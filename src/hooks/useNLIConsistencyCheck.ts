"use client"

import { useState, useCallback, useRef } from "react"

// Uses Transformers.js:
//   - Xenova/nli-deberta-v3-small  → zero-shot-classification (NLI contradiction detection)
//   - Xenova/all-MiniLM-L6-v2     → feature-extraction (semantic answer quality scoring)
//   - Big Five OCEAN personality inference from speech patterns (pure JS heuristics)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsistencyCheckResult {
  /** Two raw answer strings being compared */
  pair: [string, string]
  label: "entailment" | "neutral" | "contradiction"
  /** Confidence score 0-1 */
  confidence: number
  timestamp: number
  questionA: string
  questionB: string
}

export interface OCEANScores {
  openness: number         // 0-100
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

export interface AnswerQualityScore {
  questionId: string
  question: string
  answer: string
  /** Cosine similarity between question and answer embeddings × 100 */
  relevanceScore: number
  /** Vocabulary diversity: unique words / total words × 100 */
  richnessScore: number
  /** Heuristic sentence-flow score 0-100 */
  coherenceScore: number
  /** Weighted composite: relevance×0.5 + richness×0.25 + coherence×0.25 */
  overallScore: number
}

export interface NLIResult {
  inconsistencies: ConsistencyCheckResult[]
  answerQualities: AnswerQualityScore[]
  oceanScores: OCEANScores
  modelReady: boolean
  isAnalyzing: boolean
  // Actions
  checkConsistency: (
    questionA: string,
    answerA: string,
    questionB: string,
    answerB: string
  ) => Promise<void>
  scoreAnswer: (questionId: string, question: string, answer: string) => Promise<void>
  inferOCEAN: (transcript: string) => void
  clearAll: () => void
}

// ---------------------------------------------------------------------------
// Internal types for Transformers.js pipeline outputs
// ---------------------------------------------------------------------------

interface ZeroShotOutput {
  labels: string[]
  scores: number[]
  sequence: string
}

interface FeatureExtractionOutput {
  // Transformers.js returns a nested array: [[[...embeddings]]]
  // The actual shape depends on pooling; we handle both flat and nested.
  data?: Float32Array | number[]
  [key: number]: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes cosine similarity between two numeric vectors.
 * Returns a value in [-1, 1]; will be 0 if either vector has zero magnitude.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Sigmoid normalisation: maps any real number to (0, 100).
 * Raw heuristic counts (often tiny) are pre-scaled before calling this.
 */
function sigmoidTo100(x: number): number {
  return (1 / (1 + Math.exp(-x))) * 100
}

/**
 * Flatten a deeply-nested array / typed array returned by a feature-extraction
 * pipeline into a plain number[].
 */
function flattenEmbedding(raw: unknown): number[] {
  if (raw === null || raw === undefined) return []

  // Typed array (Float32Array, etc.)
  if (ArrayBuffer.isView(raw) && !(raw instanceof DataView)) {
    return Array.from(raw as Float32Array)
  }

  // Plain array — recursively flatten
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (typeof first === "number") return raw as number[]
    // Nested: e.g. [[[0.1, 0.2, ...]]]
    return flattenEmbedding(first)
  }

  // Transformers.js Tensor object with a `.data` property
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    return Array.from((raw as { data: Float32Array }).data)
  }

  return []
}

/**
 * Simple sentence tokeniser — splits on ., !, ?, ; followed by a space or EOL.
 */
function countSentences(text: string): number {
  const sentences = text.split(/[.!?;]+/).filter((s) => s.trim().length > 0)
  return Math.max(1, sentences.length)
}

// ---------------------------------------------------------------------------
// Word lists for OCEAN heuristics
// ---------------------------------------------------------------------------

const CONSCIENTIOUS_WORDS = new Set([
  "specifically", "exactly", "precisely", "organized", "plan", "schedule",
  "deadline", "structured", "detail", "meticulous", "systematic", "thorough",
  "careful", "accurate", "consistent", "efficient", "methodical", "documented",
  "tracked", "measured",
])

const EXTRAVERSION_WORDS = new Set([
  "team", "people", "group", "excited", "love", "enjoy", "fun", "social",
  "together", "collaborate", "share", "talk", "discuss", "energetic", "enthusiastic",
  "outgoing", "network", "connect", "meeting", "party",
])

const AGREEABLENESS_WORDS = new Set([
  "yes", "agree", "happy", "help", "support", "kind", "empathy", "care",
  "understand", "appreciate", "respect", "trust", "cooperate", "flexible",
  "patient", "compassion", "considerate", "friendly", "warm", "thankful",
])

const NEUROTICISM_WORDS = new Set([
  "worried", "nervous", "stress", "afraid", "concern", "anxious", "fear",
  "overwhelmed", "uncertain", "doubt", "panic", "tense", "uneasy", "trouble",
  "difficult", "struggle", "frustrate", "pressure", "burden", "dread",
])

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNLIConsistencyCheck(): NLIResult {
  const [inconsistencies, setInconsistencies] = useState<ConsistencyCheckResult[]>([])
  const [answerQualities, setAnswerQualities] = useState<AnswerQualityScore[]>([])
  const [oceanScores, setOceanScores] = useState<OCEANScores>({
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    neuroticism: 50,
  })
  const [modelReady, setModelReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Lazily initialised pipeline references (avoid re-creating across renders)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nliPipelineRef = useRef<((...args: any[]) => Promise<any>) | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const embeddingPipelineRef = useRef<((...args: any[]) => Promise<any>) | null>(null)
  const loadingRef = useRef(false)

  // -------------------------------------------------------------------------
  // Internal: lazy-load both pipelines
  // -------------------------------------------------------------------------
  const ensureModelsLoaded = useCallback(async (): Promise<boolean> => {
    // Already ready
    if (nliPipelineRef.current && embeddingPipelineRef.current) return true

    // Another call is already loading
    if (loadingRef.current) {
      // Poll briefly until the other call finishes or fails
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!loadingRef.current) {
            clearInterval(interval)
            resolve()
          }
        }, 200)
      })
      return !!(nliPipelineRef.current && embeddingPipelineRef.current)
    }

    loadingRef.current = true
    try {
      // Dynamic import so the library is never bundled on the server
      const { pipeline } = await import("@huggingface/transformers")

      const [nliPipe, embedPipe] = await Promise.all([
        pipeline("zero-shot-classification", "Xenova/nli-deberta-v3-small"),
        pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2"),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nliPipelineRef.current = nliPipe as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embeddingPipelineRef.current = embedPipe as any
      setModelReady(true)
      return true
    } catch (err) {
      console.error("[useNLIConsistencyCheck] Failed to load Transformers.js models:", err)
      return false
    } finally {
      loadingRef.current = false
    }
  }, [])

  // -------------------------------------------------------------------------
  // checkConsistency
  // -------------------------------------------------------------------------
  const checkConsistency = useCallback(
    async (
      questionA: string,
      answerA: string,
      questionB: string,
      answerB: string
    ): Promise<void> => {
      if (!answerA.trim() || !answerB.trim()) return

      setIsAnalyzing(true)
      try {
        const ready = await ensureModelsLoaded()
        if (!ready || !nliPipelineRef.current) {
          console.warn("[useNLIConsistencyCheck] NLI model not available, skipping consistency check.")
          return
        }

        const result = (await nliPipelineRef.current(answerA, [
          "entailment",
          "neutral",
          "contradiction",
        ])) as ZeroShotOutput

        // Map label → score
        const scoreMap: Record<string, number> = {}
        result.labels.forEach((lbl, i) => {
          scoreMap[lbl] = result.scores[i] ?? 0
        })

        const contradictionScore = scoreMap["contradiction"] ?? 0
        const topLabel = result.labels[0] as "entailment" | "neutral" | "contradiction"
        const topScore = result.scores[0] ?? 0

        // Only push to state if contradiction is confidently detected
        if (contradictionScore > 0.65) {
          const entry: ConsistencyCheckResult = {
            pair: [answerA, answerB],
            label: "contradiction",
            confidence: contradictionScore,
            timestamp: Date.now(),
            questionA,
            questionB,
          }
          setInconsistencies((prev) => [...prev, entry])
        } else if (topScore > 0.5 && topLabel !== "contradiction") {
          // Optionally record non-contradiction results for completeness
          const entry: ConsistencyCheckResult = {
            pair: [answerA, answerB],
            label: topLabel,
            confidence: topScore,
            timestamp: Date.now(),
            questionA,
            questionB,
          }
          // We only push entailment/neutral so callers can audit the full log
          setInconsistencies((prev) => [
            ...prev,
            entry,
          ])
        }
      } catch (err) {
        console.error("[useNLIConsistencyCheck] checkConsistency error:", err)
      } finally {
        setIsAnalyzing(false)
      }
    },
    [ensureModelsLoaded]
  )

  // -------------------------------------------------------------------------
  // scoreAnswer
  // -------------------------------------------------------------------------
  const scoreAnswer = useCallback(
    async (questionId: string, question: string, answer: string): Promise<void> => {
      if (!question.trim() || !answer.trim()) return

      setIsAnalyzing(true)
      try {
        const ready = await ensureModelsLoaded()
        if (!ready || !embeddingPipelineRef.current) {
          console.warn("[useNLIConsistencyCheck] Embedding model not available, skipping scoring.")
          return
        }

        // --- Relevance score via cosine similarity ---
        const [questionRaw, answerRaw] = await Promise.all([
          embeddingPipelineRef.current(question, { pooling: "mean", normalize: true }),
          embeddingPipelineRef.current(answer, { pooling: "mean", normalize: true }),
        ])

        const questionVec = flattenEmbedding(questionRaw)
        const answerVec = flattenEmbedding(answerRaw)
        const cosine = cosineSimilarity(questionVec, answerVec)
        // cosine is already in [-1,1]; clamp and map to [0,100]
        const relevanceScore = Math.min(100, Math.max(0, ((cosine + 1) / 2) * 100))

        // --- Richness score (vocabulary diversity) ---
        const words = answer
          .toLowerCase()
          .replace(/[^a-z\s]/g, "")
          .split(/\s+/)
          .filter(Boolean)
        const totalWords = words.length
        const uniqueWords = new Set(words).size
        const richnessScore = totalWords > 0
          ? Math.min(100, (uniqueWords / totalWords) * 100)
          : 0

        // --- Coherence score (sentence-flow heuristic) ---
        const sentenceCount = countSentences(answer)
        let coherenceScore: number
        if (sentenceCount > 1) {
          // Bonus: each additional sentence beyond 1 adds up to +30 points
          const varianceBonus = Math.min(30, (sentenceCount - 1) * 5)
          coherenceScore = 70 + varianceBonus
        } else {
          coherenceScore = 50
        }
        coherenceScore = Math.min(100, coherenceScore)

        // --- Composite ---
        const overallScore =
          relevanceScore * 0.5 + richnessScore * 0.25 + coherenceScore * 0.25

        const qualityEntry: AnswerQualityScore = {
          questionId,
          question,
          answer,
          relevanceScore: Math.round(relevanceScore * 10) / 10,
          richnessScore: Math.round(richnessScore * 10) / 10,
          coherenceScore: Math.round(coherenceScore * 10) / 10,
          overallScore: Math.round(overallScore * 10) / 10,
        }

        setAnswerQualities((prev) => {
          // Replace existing entry for the same questionId
          const idx = prev.findIndex((q) => q.questionId === questionId)
          if (idx !== -1) {
            const next = [...prev]
            next[idx] = qualityEntry
            return next
          }
          return [...prev, qualityEntry]
        })
      } catch (err) {
        console.error("[useNLIConsistencyCheck] scoreAnswer error:", err)
      } finally {
        setIsAnalyzing(false)
      }
    },
    [ensureModelsLoaded]
  )

  // -------------------------------------------------------------------------
  // inferOCEAN  (pure JS, no model needed)
  // -------------------------------------------------------------------------
  const inferOCEAN = useCallback((transcript: string): void => {
    if (!transcript.trim()) return

    const normalized = transcript.toLowerCase().replace(/[^a-z\s]/g, "")
    const words = normalized.split(/\s+/).filter(Boolean)
    const totalWords = words.length

    if (totalWords === 0) return

    // Openness → vocabulary diversity
    const uniqueCount = new Set(words).size
    const rawOpenness = uniqueCount / totalWords // 0-1
    const openness = sigmoidTo100((rawOpenness - 0.5) * 10) // centre around 0.5

    // Conscientiousness, Extraversion, Agreeableness, Neuroticism
    // Count matching words, normalise per 1000 words, then sigmoidTo100
    let conscientiousnessCount = 0
    let extraversionCount = 0
    let agreeablenessCount = 0
    let neuroticismCount = 0

    for (const word of words) {
      if (CONSCIENTIOUS_WORDS.has(word)) conscientiousnessCount++
      if (EXTRAVERSION_WORDS.has(word)) extraversionCount++
      if (AGREEABLENESS_WORDS.has(word)) agreeablenessCount++
      if (NEUROTICISM_WORDS.has(word)) neuroticismCount++
    }

    const ratePer1000 = (count: number) => (count / totalWords) * 1000

    // Sigmoid centred at 5 occurrences per 1000 words → score ~50
    const scoreFromRate = (rate: number) => sigmoidTo100((rate - 5) * 0.5)

    const conscientiousness = scoreFromRate(ratePer1000(conscientiousnessCount))
    const extraversion = scoreFromRate(ratePer1000(extraversionCount))
    const agreeableness = scoreFromRate(ratePer1000(agreeablenessCount))
    const neuroticism = scoreFromRate(ratePer1000(neuroticismCount))

    setOceanScores({
      openness: Math.round(openness * 10) / 10,
      conscientiousness: Math.round(conscientiousness * 10) / 10,
      extraversion: Math.round(extraversion * 10) / 10,
      agreeableness: Math.round(agreeableness * 10) / 10,
      neuroticism: Math.round(neuroticism * 10) / 10,
    })
  }, [])

  // -------------------------------------------------------------------------
  // clearAll
  // -------------------------------------------------------------------------
  const clearAll = useCallback((): void => {
    setInconsistencies([])
    setAnswerQualities([])
    setOceanScores({
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
    })
  }, [])

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    inconsistencies,
    answerQualities,
    oceanScores,
    modelReady,
    isAnalyzing,
    checkConsistency,
    scoreAnswer,
    inferOCEAN,
    clearAll,
  }
}
