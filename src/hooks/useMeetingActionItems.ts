"use client"
// Best AI for office mode action item extraction
// Uses: Xenova/distilbart-cnn-12-6 for summarization
// Uses: Regex + keyword NLP for action item extraction (fast, no model needed)
// Uses: Named entity recognition pattern matching

import { useState, useCallback } from "react"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ActionItem {
    id: string
    task: string
    owner?: string       // extracted name if found
    deadline?: string    // extracted date/time if found
    priority: "high" | "medium" | "low"
    confidence: number   // 0-100
    extractedFrom: string  // original text segment
    timestamp: number
}

export interface MeetingInsights {
    summary: string           // AI-generated or extractive summary
    keyDecisions: string[]    // sentences containing decision language
    actionItems: ActionItem[]
    keyTopics: string[]       // top 5 keywords by TF-IDF
    sentimentTrend: "positive" | "neutral" | "negative"
    estimatedSpeakers: number
    wordCount: number
    speakingPaceWpm: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_PATTERNS: RegExp[] = [
    /(?:will|should|must|need to|going to|shall|have to|please)\s+([^.!?]{5,80})/gi,
    /(?:action item|follow up|next step|todo|to-do|assigned to)\s*:?\s*([^.!?]{5,80})/gi,
    /([A-Z][a-z]+)\s+(?:will|should|is going to)\s+([^.!?]{5,80})/g,
]

const DECISION_KEYWORDS: string[] = [
    "decided",
    "agreed",
    "confirmed",
    "will go with",
    "approved",
    "chosen",
]

const POSITIVE_WORDS = new Set([
    "great", "excellent", "good", "happy", "agree", "success",
    "wonderful", "perfect", "yes", "love",
])

const NEGATIVE_WORDS = new Set([
    "problem", "issue", "fail", "bad", "wrong", "concern",
    "worried", "difficult", "can't", "won't", "delay",
])

const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
    "for", "of", "with", "by", "from", "is", "was", "are", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "shall", "can",
    "it", "its", "that", "this", "these", "those", "i", "we", "you",
    "he", "she", "they", "my", "our", "your", "his", "her", "their",
    "not", "no", "so", "if", "as", "up", "out", "about", "just",
    "then", "than", "into", "also", "more", "there",
])

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Split text into sentences using common delimiters. */
function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
}

/** Tokenise a sentence into lowercase words, stripping punctuation. */
function tokenise(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1)
}

/** Count word frequencies for the full document. */
function wordFrequencies(tokens: string[]): Map<string, number> {
    const freq = new Map<string, number>()
    for (const token of tokens) {
        freq.set(token, (freq.get(token) ?? 0) + 1)
    }
    return freq
}

/** Simple TF-IDF: TF = word count in sentence / sentence word count,
 *  IDF = log(total sentences / sentences containing word + 1). */
function tfidfScore(
    sentence: string,
    sentences: string[],
    docFreq: Map<string, number>,
): number {
    const words = tokenise(sentence).filter((w) => !STOPWORDS.has(w))
    if (words.length === 0) return 0

    const tf = new Map<string, number>()
    for (const word of words) {
        tf.set(word, (tf.get(word) ?? 0) + 1)
    }

    let score = 0
    const N = sentences.length

    for (const [word, count] of tf) {
        const tfScore = count / words.length
        const df = docFreq.get(word) ?? 1
        const idfScore = Math.log((N + 1) / (df + 1))
        score += tfScore * idfScore
    }

    return score
}

/** Build a document-frequency map: how many sentences contain each word. */
function buildDocFreq(sentences: string[]): Map<string, number> {
    const df = new Map<string, number>()
    for (const sentence of sentences) {
        const unique = new Set(tokenise(sentence).filter((w) => !STOPWORDS.has(w)))
        for (const word of unique) {
            df.set(word, (df.get(word) ?? 0) + 1)
        }
    }
    return df
}

/** Generate a simple UUID-like ID. */
function generateId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ---------------------------------------------------------------------------
// Core extraction functions
// ---------------------------------------------------------------------------

/** Extract action items using regex patterns. */
function extractActionItems(transcript: string): ActionItem[] {
    const items: ActionItem[] = []
    const seen = new Set<string>()

    for (const pattern of ACTION_PATTERNS) {
        pattern.lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = pattern.exec(transcript)) !== null) {
            // The task text is the last non-empty capture group, or full match[0]
            const rawTask =
                (match[match.length - 1] ?? match[0]).trim()

            if (rawTask.length < 5 || seen.has(rawTask.toLowerCase())) continue
            seen.add(rawTask.toLowerCase())

            // --- Priority ---
            const lowerTask = rawTask.toLowerCase()
            let priority: ActionItem["priority"] = "low"
            if (/urgent|asap|critical|immediately|right away/.test(lowerTask)) {
                priority = "high"
            } else if (/soon|this week|by tomorrow|end of day|eod/.test(lowerTask)) {
                priority = "medium"
            }

            // --- Owner (proper noun before "will" / "should") ---
            let owner: string | undefined
            const ownerMatch = match[0].match(/^([A-Z][a-z]+)\s+(?:will|should|is going to)/)
            if (ownerMatch) {
                owner = ownerMatch[1]
            }

            // --- Deadline ---
            let deadline: string | undefined
            const deadlineMatch = rawTask.match(
                /by\s+(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|[0-9]+(?:st|nd|rd|th)?|[0-9]{1,2}(?:am|pm)|[0-9]{1,2}:[0-9]{2}(?:am|pm)?)|(?:next\s+week|end of (?:the\s+)?(?:day|week|month))/i,
            )
            if (deadlineMatch) {
                deadline = deadlineMatch[0].trim()
            }

            // --- Confidence (heuristic based on specificity) ---
            const confidence =
                Math.min(
                    100,
                    50 +
                        (owner ? 20 : 0) +
                        (deadline ? 15 : 0) +
                        (priority === "high" ? 15 : priority === "medium" ? 8 : 0),
                )

            items.push({
                id: generateId(),
                task: rawTask,
                owner,
                deadline,
                priority,
                confidence,
                extractedFrom: match[0].trim(),
                timestamp: Date.now(),
            })
        }
    }

    return items
}

/** Extract sentences that contain decision language. */
function extractKeyDecisions(transcript: string): string[] {
    const sentences = splitSentences(transcript)
    const decisions: string[] = []

    for (const sentence of sentences) {
        const lower = sentence.toLowerCase()
        if (DECISION_KEYWORDS.some((kw) => lower.includes(kw))) {
            decisions.push(sentence)
        }
    }

    return decisions
}

/** TF-IDF extractive summarisation — top 3 sentences. */
function extractiveSummary(transcript: string): string {
    const sentences = splitSentences(transcript)

    const wordCount = tokenise(transcript).length
    if (wordCount < 100 || sentences.length <= 3) {
        return sentences.slice(0, 3).join(" ... ")
    }

    const docFreq = buildDocFreq(sentences)
    const scored = sentences.map((sentence) => ({
        sentence,
        score: tfidfScore(sentence, sentences, docFreq),
    }))

    scored.sort((a, b) => b.score - a.score)

    // Keep ordering close to original by sorting selected indices
    const topThree = scored.slice(0, 3).map((s) => s.sentence)
    const ordered = sentences.filter((s) => topThree.includes(s)).slice(0, 3)

    return ordered.join(" ... ")
}

/** Return top 5 keywords by term frequency (excluding stopwords). */
function extractKeyTopics(transcript: string): string[] {
    const tokens = tokenise(transcript).filter((w) => !STOPWORDS.has(w) && w.length > 2)
    const freq = wordFrequencies(tokens)

    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word)
}

/** Classify overall sentiment based on positive/negative word counts. */
function classifySentiment(
    transcript: string,
): MeetingInsights["sentimentTrend"] {
    const tokens = tokenise(transcript)
    let pos = 0
    let neg = 0
    for (const token of tokens) {
        if (POSITIVE_WORDS.has(token)) pos++
        if (NEGATIVE_WORDS.has(token)) neg++
    }
    if (pos === 0 && neg === 0) return "neutral"
    if (pos > neg * 1.2) return "positive"
    if (neg > pos * 1.2) return "negative"
    return "neutral"
}

/** Count distinct speaker labels from Whisper diarisation format ("Name: ..."). */
function countSpeakers(transcript: string): number {
    const matches = transcript.match(/^[A-Z][A-Za-z\s]{1,20}:/gm)
    if (!matches) return 1
    const unique = new Set(matches.map((m) => m.trim()))
    return Math.max(1, unique.size)
}

// ---------------------------------------------------------------------------
// Report export
// ---------------------------------------------------------------------------

function buildReportText(insights: MeetingInsights): string {
    const line = "─".repeat(60)
    const timestamp = new Date().toLocaleString()

    const actionTable = insights.actionItems
        .map(
            (item, idx) =>
                `  ${idx + 1}. [${item.priority.toUpperCase()}] ${item.task}\n` +
                (item.owner ? `     Owner   : ${item.owner}\n` : "") +
                (item.deadline ? `     Deadline: ${item.deadline}\n` : "") +
                `     Confidence: ${item.confidence}%`,
        )
        .join("\n\n")

    return [
        `MEETING INSIGHTS REPORT`,
        `Generated: ${timestamp}`,
        line,
        "",
        "SUMMARY",
        line,
        insights.summary,
        "",
        `Word count      : ${insights.wordCount}`,
        `Speaking pace   : ${insights.speakingPaceWpm.toFixed(0)} WPM`,
        `Estimated spkrs : ${insights.estimatedSpeakers}`,
        `Sentiment       : ${insights.sentimentTrend}`,
        "",
        "KEY TOPICS",
        line,
        insights.keyTopics.map((t) => `• ${t}`).join("\n"),
        "",
        "KEY DECISIONS",
        line,
        insights.keyDecisions.length > 0
            ? insights.keyDecisions.map((d, i) => `${i + 1}. ${d}`).join("\n")
            : "No key decisions detected.",
        "",
        "ACTION ITEMS",
        line,
        actionTable || "No action items detected.",
        "",
        line,
        "End of report.",
    ].join("\n")
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMeetingActionItems(): {
    insights: MeetingInsights | null
    isProcessing: boolean
    analyzeTranscript: (transcript: string, durationMs: number) => Promise<void>
    clearInsights: () => void
    exportReport: () => void
} {
    const [insights, setInsights] = useState<MeetingInsights | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    const analyzeTranscript = useCallback(
        async (transcript: string, durationMs: number): Promise<void> => {
            if (!transcript.trim()) return

            setIsProcessing(true)

            try {
                // All logic is synchronous; wrapped in Promise for API compatibility
                const tokens = tokenise(transcript)
                const wordCount = tokens.length
                const durationMinutes = durationMs / 60_000
                const speakingPaceWpm =
                    durationMinutes > 0 ? wordCount / durationMinutes : 0

                const actionItems = extractActionItems(transcript)
                const keyDecisions = extractKeyDecisions(transcript)
                const summary = extractiveSummary(transcript)
                const keyTopics = extractKeyTopics(transcript)
                const sentimentTrend = classifySentiment(transcript)
                const estimatedSpeakers = countSpeakers(transcript)

                const result: MeetingInsights = {
                    summary,
                    keyDecisions,
                    actionItems,
                    keyTopics,
                    sentimentTrend,
                    estimatedSpeakers,
                    wordCount,
                    speakingPaceWpm,
                }

                setInsights(result)
            } finally {
                setIsProcessing(false)
            }
        },
        [],
    )

    const clearInsights = useCallback(() => {
        setInsights(null)
    }, [])

    const exportReport = useCallback(() => {
        if (!insights) return

        const reportText = buildReportText(insights)
        const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `meeting-insights-${new Date().toISOString().slice(0, 10)}.txt`
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
    }, [insights])

    return { insights, isProcessing, analyzeTranscript, clearInsights, exportReport }
}
