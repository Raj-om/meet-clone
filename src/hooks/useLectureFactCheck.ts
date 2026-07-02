/**
 * useLectureFactCheck.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time lecture fact-checker + auto-document generator.
 *
 * Pipeline:
 *  1. Receives Whisper transcript segments in real-time
 *  2. Detects factual claims using regex heuristics (NLP-lite)
 *  3. Queries Wikipedia REST API for the claim's subject
 *  4. Compares claim against Wikipedia summary → verdict
 *  5. Accumulates results for document export
 *
 * Verdicts:
 *   ✅ CORRECT   — statement consistent with Wikipedia
 *   ⚠️ UNCERTAIN — Wikipedia found but can't confirm/deny
 *   ❌ WRONG     — clear contradiction with Wikipedia
 *   🔍 CHECKING  — query in flight
 */

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { TranscriptSegment } from "./useWhisperTranscription"

// ── Types ─────────────────────────────────────────────────────────────────────
export type ClaimVerdict = "CORRECT" | "WRONG" | "UNCERTAIN" | "CHECKING" | "PENDING"

export interface FactClaim {
    id: string
    rawSentence: string          // Original spoken sentence
    subject: string              // Extracted subject of the claim
    claimText: string            // Normalised claim
    verdict: ClaimVerdict
    confidence: number           // 0–100
    wikiSummary: string          // Wikipedia evidence used
    wikiUrl: string
    correction: string           // Empty if correct; correction text if wrong
    timestamp: number
}

export interface LectureFactCheckResult {
    claims: FactClaim[]
    pendingCount: number
    correctCount: number
    wrongCount: number
    uncertainCount: number
    isActive: boolean
    /** Call at end of lecture to get full fact-checked document data */
    getDocumentData: () => DocumentData
}

export interface DocumentData {
    claims: FactClaim[]
    transcript: string
    generatedAt: number
}

// ── Claim detection patterns ──────────────────────────────────────────────────
// Matches: "X is a/an ...", "X was ...", "X discovered ...", "X = ..."
// "X has N ...", "X invented ...", "the X of Y is Z"
const CLAIM_PATTERNS = [
    /([A-Z][a-zA-Z\s]{2,30})\s+(?:is|was|are|were|has|have|had|invented|discovered|created|founded|equals?|means?)\s+(.{10,120})/,
    /([A-Z][a-zA-Z\s]{2,30})\s+(?:was born|was discovered|was invented|was founded|was created)\s+(?:in|by|on)\s+(.{5,80})/,
    /the\s+([a-zA-Z\s]{2,30})\s+of\s+([a-zA-Z\s]{2,30})\s+is\s+(.{5,80})/i,
    /([A-Z][a-zA-Z\s]{2,25})\s+(?:\([\w\s]+\)\s+)?(?:is|was)\s+(?:the|a|an)\s+([a-zA-Z\s,]{10,100})/,
]

const SKIP_SUBJECTS = new Set(["i", "we", "you", "he", "she", "they", "it", "this", "that", "there", "here"])

function extractClaims(text: string): Array<{ subject: string; claimText: string; raw: string }> {
    const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [text]
    const claims: Array<{ subject: string; claimText: string; raw: string }> = []

    for (const sentence of sentences) {
        if (sentence.trim().length < 20) continue
        for (const pattern of CLAIM_PATTERNS) {
            const m = sentence.match(pattern)
            if (m) {
                const subject = (m[1] ?? "").trim().toLowerCase()
                if (SKIP_SUBJECTS.has(subject) || subject.length < 2) continue
                claims.push({
                    subject: (m[1] ?? "").trim(),
                    claimText: sentence.trim(),
                    raw: sentence.trim(),
                })
                break
            }
        }
    }
    return claims
}

// ── Wikipedia API query ───────────────────────────────────────────────────────
interface WikiResult {
    summary: string
    url: string
    found: boolean
}

async function queryWikipedia(subject: string): Promise<WikiResult> {
    const encoded = encodeURIComponent(subject.trim())
    try {
        const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
            { signal: AbortSignal.timeout(6000) }
        )
        if (!res.ok) {
            // Try search if direct lookup fails
            const searchRes = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=1`,
                { signal: AbortSignal.timeout(5000) }
            )
            if (!searchRes.ok) return { summary: "", url: "", found: false }
            const searchData = await searchRes.json()
            const title = searchData?.query?.search?.[0]?.title
            if (!title) return { summary: "", url: "", found: false }
            const titleRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                { signal: AbortSignal.timeout(5000) }
            )
            if (!titleRes.ok) return { summary: "", url: "", found: false }
            const data = await titleRes.json()
            return {
                summary: data.extract ?? "",
                url: data.content_urls?.desktop?.page ?? "",
                found: !!data.extract,
            }
        }
        const data = await res.json()
        return {
            summary: data.extract ?? "",
            url: data.content_urls?.desktop?.page ?? "",
            found: !!data.extract,
        }
    } catch {
        return { summary: "", url: "", found: false }
    }
}

// ── Verdict engine ────────────────────────────────────────────────────────────
function computeVerdict(
    claimText: string,
    subject: string,
    wikiSummary: string,
): { verdict: ClaimVerdict; confidence: number; correction: string } {
    if (!wikiSummary) return { verdict: "UNCERTAIN", confidence: 30, correction: "" }

    const claimLower = claimText.toLowerCase()
    const wikiLower  = wikiSummary.toLowerCase()

    // Extract key claim words (remove stop words)
    const claimWords = claimLower
        .replace(/[^a-z\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 3 && !["that", "this", "with", "from", "have", "been", "were", "they", "them"].includes(w))

    // Count how many claim keywords appear in Wikipedia
    const matches = claimWords.filter(w => wikiLower.includes(w)).length
    const ratio    = claimWords.length > 0 ? matches / claimWords.length : 0

    // Contradiction signals: negation in wiki about claim subject
    const negations = [" not ", " never ", " no ", " false ", " incorrect ", " wrong "]
    const subjectInWiki = wikiLower.includes(subject.toLowerCase().slice(0, 8))
    const hasNegation   = negations.some(n => {
        const idx = wikiLower.indexOf(subject.toLowerCase().slice(0, 6))
        if (idx === -1) return false
        const context = wikiLower.slice(Math.max(0, idx - 30), idx + 100)
        return context.includes(n.trim())
    })

    // Number comparison: extract numbers from claim and check wiki
    const claimNums = claimText.match(/\d[\d,.]*/g) ?? []
    const wikiNums  = wikiSummary.match(/\d[\d,.]*/g) ?? []
    let numConflict = false
    if (claimNums.length > 0 && wikiNums.length > 0) {
        const claimNumStr = claimNums[0]
        const wikiNumStr = wikiNums[0]
        if (claimNumStr && wikiNumStr) {
            const claimN = parseFloat(claimNumStr.replace(/,/g, ""))
            const wikiN  = parseFloat(wikiNumStr.replace(/,/g, ""))
            if (!isNaN(claimN) && !isNaN(wikiN) && Math.abs(claimN - wikiN) / Math.max(claimN, wikiN) > 0.2) {
                numConflict = true
            }
        }
    }

    if (numConflict || (hasNegation && subjectInWiki)) {
        const correction = wikiSummary.split(".").slice(0, 2).join(".") + "."
        return { verdict: "WRONG", confidence: 75, correction }
    }

    if (ratio > 0.5 && subjectInWiki) {
        return { verdict: "CORRECT", confidence: Math.round(ratio * 90), correction: "" }
    }

    if (ratio > 0.25) {
        return { verdict: "UNCERTAIN", confidence: Math.round(ratio * 60), correction: "" }
    }

    return { verdict: "UNCERTAIN", confidence: 20, correction: "" }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useLectureFactCheck(
    transcriptHistory: TranscriptSegment[],
    enabled: boolean,
): LectureFactCheckResult {
    const [claims, setClaims] = useState<FactClaim[]>([])
    const processedIdsRef     = useRef<Set<string>>(new Set())
    const queueRef            = useRef<Array<{ subject: string; claimText: string; raw: string; segmentId: string; timestamp: number }>>([])
    const processingRef       = useRef(false)

    // Process queue one-by-one (rate-limit Wikipedia requests)
    const processQueue = useCallback(async () => {
        if (processingRef.current || queueRef.current.length === 0) return
        processingRef.current = true

        const item = queueRef.current.shift()!
        const id   = `${item.segmentId}-${item.subject.slice(0, 8)}`

        // Set to CHECKING
        setClaims(prev => prev.map(c => c.id === id ? { ...c, verdict: "CHECKING" } : c))

        const wiki = await queryWikipedia(item.subject)
        await new Promise(r => setTimeout(r, 300)) // polite delay

        const { verdict, confidence, correction } = computeVerdict(item.claimText, item.subject, wiki.summary)

        setClaims(prev => prev.map(c => c.id === id ? {
            ...c,
            verdict,
            confidence,
            wikiSummary: wiki.summary.slice(0, 300),
            wikiUrl: wiki.url,
            correction,
        } : c))

        processingRef.current = false
        // Chain next item
        setTimeout(processQueue, 500)
    }, [])

    // Watch for new transcript segments
    useEffect(() => {
        if (!enabled || transcriptHistory.length === 0) return

        const latest = transcriptHistory[transcriptHistory.length - 1]
        if (processedIdsRef.current.has(latest.id)) return
        processedIdsRef.current.add(latest.id)

        const extracted = extractClaims(latest.text)
        if (extracted.length === 0) return

        const newClaims: FactClaim[] = extracted.map((e, i) => ({
            id: `${latest.id}-${i}`,
            rawSentence: e.raw,
            subject: e.subject,
            claimText: e.claimText,
            verdict: "PENDING",
            confidence: 0,
            wikiSummary: "",
            wikiUrl: "",
            correction: "",
            timestamp: latest.timestamp,
        }))

        setClaims(prev => [...prev, ...newClaims])

        // Enqueue for verification
        extracted.forEach((e, i) => {
            queueRef.current.push({
                subject: e.subject,
                claimText: e.claimText,
                raw: e.raw,
                segmentId: `${latest.id}-${i}`,
                timestamp: latest.timestamp,
            })
        })

        processQueue()
    }, [transcriptHistory, enabled, processQueue])

    const getDocumentData = useCallback((): DocumentData => ({
        claims,
        transcript: transcriptHistory.map(s => `[${new Date(s.timestamp).toLocaleTimeString()}] ${s.speakerName}: ${s.text}`).join("\n"),
        generatedAt: Date.now(),
    }), [claims, transcriptHistory])

    const correctCount   = claims.filter(c => c.verdict === "CORRECT").length
    const wrongCount     = claims.filter(c => c.verdict === "WRONG").length
    const uncertainCount = claims.filter(c => c.verdict === "UNCERTAIN").length
    const pendingCount   = claims.filter(c => c.verdict === "PENDING" || c.verdict === "CHECKING").length

    return {
        claims,
        pendingCount,
        correctCount,
        wrongCount,
        uncertainCount,
        isActive: enabled,
        getDocumentData,
    }
}
