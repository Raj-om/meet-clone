"use client"

/**
 * MeetingSummaryModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Post-meeting AI summary panel using 100% local, offline NLP.
 *
 * Research basis (2025/2026):
 *   Agentic AI meeting assistants that go beyond transcription — summarising,
 *   extracting action items, and categorising topics. This implementation uses
 *   TF-IDF keyword extraction + sentence scoring (no API key, no server).
 *
 * Algorithm:
 *   1. Tokenise transcript into sentences
 *   2. Build a TF-IDF matrix per sentence
 *   3. Score each sentence by its TF-IDF sum (TextRank-lite)
 *   4. Top-N sentences form the "Executive Summary"
 *   5. Detect action items via verb-phrase regex ("will", "need to", "should", "must", "action:")
 *   6. Cluster remaining high-TF-IDF nouns into "Key Topics"
 */

import { useState, useEffect, useCallback } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────
interface SummaryData {
    executiveSummary: string[]    // Top representative sentences
    actionItems: string[]         // Extracted action items
    keyTopics: string[]           // Top keyword clusters
    wordCount: number
    durationMin: number
    participantNames: string[]
}

interface MeetingSummaryModalProps {
    transcript: string            // Raw transcript from useWhisperTranscription
    chatMessages?: { sender: string; text: string }[]
    durationMs: number
    participantNames: string[]
    onClose: () => void
}

// ── Stop words ────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "by","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","can",
    "i","we","you","he","she","they","it","this","that","these","those",
    "our","your","their","my","his","her","its","from","as","so","if",
    "not","also","just","then","than","more","very","all","about","up",
    "out","there","what","which","who","how","when","where","ok","yeah",
    "um","uh","hmm","right","like","know","think","going","get","got",
])

// ── Local NLP engine ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
    return text.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) ?? []
}

function splitSentences(text: string): string[] {
    // Split on ". " or "\n" boundaries, keeping at least 15 chars
    return text
        .split(/(?<=[.!?])\s+|\n/)
        .map(s => s.replace(/^\s*\[[\d:]+\]\s*[^:]+:\s*/, "").trim()) // strip timestamps+names
        .filter(s => s.length > 15)
}

function buildTFIDF(sentences: string[]): Map<string, number>[] {
    const corpusSize = sentences.length || 1
    const tokenLists = sentences.map(tokenize)

    // IDF: log(N / df)
    const df = new Map<string, number>()
    for (const tokens of tokenLists) {
        for (const t of new Set(tokens)) {
            if (!STOP_WORDS.has(t)) df.set(t, (df.get(t) ?? 0) + 1)
        }
    }
    const idf = (term: string) => Math.log(corpusSize / (df.get(term) ?? 1) + 1)

    return tokenLists.map(tokens => {
        const tf = new Map<string, number>()
        for (const t of tokens) {
            if (!STOP_WORDS.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1)
        }
        const scores = new Map<string, number>()
        for (const [term, freq] of tf) {
            scores.set(term, (freq / tokens.length) * idf(term))
        }
        return scores
    })
}

function scoreSentences(sentences: string[], tfidf: Map<string, number>[]): number[] {
    return tfidf.map(scores => {
        let total = 0
        for (const v of scores.values()) total += v
        return total
    })
}

function extractActionItems(sentences: string[]): string[] {
    const patterns = [
        /\b(will|going to|need to|needs to|must|should|shall|action:|follow.?up|to.?do|task:)\b.{5,80}/i,
        /\bplease\b.{3,60}/i,
        /\bremember to\b.{3,60}/i,
    ]
    const items: string[] = []
    for (const s of sentences) {
        for (const p of patterns) {
            const m = s.match(p)
            if (m) {
                const raw = m[0].trim()
                // Capitalize first letter
                const clean = raw.charAt(0).toUpperCase() + raw.slice(1)
                if (!items.includes(clean)) items.push(clean)
                break
            }
        }
    }
    return items.slice(0, 8)
}

function extractKeyTopics(tfidf: Map<string, number>[]): string[] {
    const globalScores = new Map<string, number>()
    for (const scores of tfidf) {
        for (const [term, score] of scores) {
            globalScores.set(term, (globalScores.get(term) ?? 0) + score)
        }
    }
    return [...globalScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([term]) => term.charAt(0).toUpperCase() + term.slice(1))
}

function generateSummary(transcript: string, participantNames: string[], durationMs: number): SummaryData {
    const sentences = splitSentences(transcript)
    const wordCount = tokenize(transcript).length
    const durationMin = Math.round(durationMs / 60_000)

    if (sentences.length === 0) {
        return {
            executiveSummary: ["No speech was transcribed during this session."],
            actionItems: [],
            keyTopics: [],
            wordCount: 0,
            durationMin,
            participantNames,
        }
    }

    const tfidf  = buildTFIDF(sentences)
    const scores = scoreSentences(sentences, tfidf)

    // Top sentences sorted by score (keeping original order for readability)
    const N = Math.min(5, Math.max(2, Math.round(sentences.length * 0.15)))
    const topIdx = scores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .slice(0, N)
        .map(x => x.idx)
        .sort((a, b) => a - b) // restore chronological order

    const executiveSummary = topIdx.map(i => sentences[i])
    const actionItems = extractActionItems(sentences)
    const keyTopics  = extractKeyTopics(tfidf)

    return { executiveSummary, actionItems, keyTopics, wordCount, durationMin, participantNames }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeetingSummaryModal({
    transcript,
    chatMessages = [],
    durationMs,
    participantNames,
    onClose,
}: MeetingSummaryModalProps) {
    const [summary, setSummary] = useState<SummaryData | null>(null)
    const [isGenerating, setIsGenerating] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        // Run local NLP on next tick to let the UI render first
        const t = setTimeout(() => {
            // Combine spoken transcript + chat for richer analysis
            const chatText = chatMessages
                .map(m => `${m.sender}: ${m.text}`)
                .join(". ")
            const fullText = [transcript, chatText].filter(Boolean).join(" ")
            const result = generateSummary(fullText, participantNames, durationMs)
            setSummary(result)
            setIsGenerating(false)
        }, 150)
        return () => clearTimeout(t)
    }, [transcript, chatMessages, participantNames, durationMs])

    const downloadSummary = useCallback(() => {
        if (!summary) return
        const lines: string[] = [
            "═══════════════════════════════════════",
            "   MEET CLONE — AI MEETING SUMMARY",
            "═══════════════════════════════════════",
            `Date      : ${new Date().toLocaleDateString()}`,
            `Duration  : ${summary.durationMin} min`,
            `Words     : ${summary.wordCount}`,
            `Attendees : ${summary.participantNames.join(", ") || "—"}`,
            "",
            "── EXECUTIVE SUMMARY ──",
            ...summary.executiveSummary.map((s, i) => `${i + 1}. ${s}`),
            "",
            "── ACTION ITEMS ──",
            summary.actionItems.length > 0
                ? summary.actionItems.map((a, i) => `☐  ${i + 1}. ${a}`).join("\n")
                : "   No action items detected.",
            "",
            "── KEY TOPICS ──",
            summary.keyTopics.join("  •  "),
            "",
            "── FULL TRANSCRIPT ──",
            transcript || "(no transcript)",
        ]
        const blob = new Blob([lines.join("\n")], { type: "text/plain" })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href     = url
        a.download = `Meeting-Summary-${Date.now()}.txt`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
    }, [summary, transcript])

    const copyToClipboard = useCallback(() => {
        if (!summary) return
        const text = [
            "EXECUTIVE SUMMARY",
            ...summary.executiveSummary.map((s, i) => `${i + 1}. ${s}`),
            "",
            "ACTION ITEMS",
            ...summary.actionItems.map((a, i) => `☐ ${i + 1}. ${a}`),
            "",
            "KEY TOPICS",
            summary.keyTopics.join(", "),
        ].join("\n")
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }, [summary])

    const overlay: React.CSSProperties = {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
    }
    const modal: React.CSSProperties = {
        background: "linear-gradient(135deg, #1a1d2e 0%, #0f1117 100%)",
        border: "1px solid rgba(139,92,246,0.4)",
        borderRadius: "16px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.2)",
        width: "min(720px, 95vw)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    }

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={modal}>
                {/* Header */}
                <div style={{
                    padding: "20px 24px 16px",
                    borderBottom: "1px solid rgba(139,92,246,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "linear-gradient(90deg, rgba(139,92,246,0.12) 0%, transparent 100%)",
                }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "22px" }}>🧠</span>
                            <span style={{ color: "white", fontSize: "18px", fontWeight: 700, letterSpacing: "-0.3px" }}>
                                AI Meeting Summary
                            </span>
                            <span style={{
                                background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)",
                                borderRadius: "99px", padding: "2px 8px",
                                color: "#a78bfa", fontSize: "10px", fontWeight: 700, letterSpacing: "1px",
                            }}>LOCAL AI · PRIVATE</span>
                        </div>
                        <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
                            Generated on-device via TF-IDF extraction — no data sent to any server
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: "none", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px", color: "#9ca3af", cursor: "pointer",
                        padding: "6px 10px", fontSize: "16px",
                    }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
                    {isGenerating ? (
                        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                            <div style={{
                                width: "48px", height: "48px",
                                border: "3px solid rgba(139,92,246,0.3)",
                                borderTopColor: "#8b5cf6",
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                                margin: "0 auto 16px",
                            }} />
                            <div style={{ fontSize: "15px", fontWeight: 600, color: "#c4b5fd" }}>
                                Analysing conversation…
                            </div>
                            <div style={{ fontSize: "12px", marginTop: "6px" }}>
                                Running TF-IDF extraction &amp; sentence scoring
                            </div>
                        </div>
                    ) : summary ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* Stats bar */}
                            <div style={{
                                display: "flex", gap: "12px", flexWrap: "wrap",
                            }}>
                                {[
                                    { label: "Duration", value: `${summary.durationMin} min`, icon: "⏱" },
                                    { label: "Words spoken", value: summary.wordCount.toLocaleString(), icon: "💬" },
                                    { label: "Attendees", value: String(summary.participantNames.length || 1), icon: "👥" },
                                    { label: "Action items", value: String(summary.actionItems.length), icon: "☑️" },
                                ].map(stat => (
                                    <div key={stat.label} style={{
                                        flex: "1 1 120px",
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderRadius: "10px",
                                        padding: "12px 14px",
                                    }}>
                                        <div style={{ fontSize: "18px" }}>{stat.icon}</div>
                                        <div style={{ color: "white", fontWeight: 700, fontSize: "20px", marginTop: "4px" }}>{stat.value}</div>
                                        <div style={{ color: "#6b7280", fontSize: "11px" }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Executive Summary */}
                            <Section title="📋 Executive Summary" color="#60a5fa">
                                {summary.executiveSummary.length > 0 ? (
                                    <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {summary.executiveSummary.map((s, i) => (
                                            <li key={i} style={{ color: "#e2e8f0", fontSize: "14px", lineHeight: "1.6" }}>{s}</li>
                                        ))}
                                    </ol>
                                ) : (
                                    <EmptyState text="Not enough speech to summarise." />
                                )}
                            </Section>

                            {/* Action Items */}
                            <Section title="✅ Action Items" color="#34d399">
                                {summary.actionItems.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {summary.actionItems.map((a, i) => (
                                            <div key={i} style={{
                                                display: "flex", alignItems: "flex-start", gap: "10px",
                                                background: "rgba(52,211,153,0.06)",
                                                border: "1px solid rgba(52,211,153,0.15)",
                                                borderRadius: "8px",
                                                padding: "8px 12px",
                                            }}>
                                                <span style={{ color: "#34d399", marginTop: "1px" }}>☐</span>
                                                <span style={{ color: "#d1fae5", fontSize: "13px", lineHeight: "1.5" }}>{a}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text="No explicit action items detected." />
                                )}
                            </Section>

                            {/* Key Topics */}
                            <Section title="🏷️ Key Topics" color="#f59e0b">
                                {summary.keyTopics.length > 0 ? (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                        {summary.keyTopics.map((topic, i) => (
                                            <span key={i} style={{
                                                background: "rgba(245,158,11,0.12)",
                                                border: "1px solid rgba(245,158,11,0.3)",
                                                borderRadius: "99px",
                                                padding: "4px 12px",
                                                color: "#fcd34d",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                            }}>{topic}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text="No significant topics detected." />
                                )}
                            </Section>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                {!isGenerating && (
                    <div style={{
                        padding: "14px 24px",
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                        display: "flex", gap: "10px", justifyContent: "flex-end",
                    }}>
                        <button onClick={copyToClipboard} style={btnStyle("#4b5563")}>
                            {copied ? "✅ Copied!" : "📋 Copy Summary"}
                        </button>
                        <button onClick={downloadSummary} style={btnStyle("#7c3aed")}>
                            ⬇️ Download .txt
                        </button>
                        <button onClick={onClose} style={btnStyle("#1f2937")}>
                            Close
                        </button>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
    return (
        <div style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            overflow: "hidden",
        }}>
            <div style={{
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: `linear-gradient(90deg, ${color}12 0%, transparent 100%)`,
            }}>
                <span style={{ color, fontWeight: 700, fontSize: "13px" }}>{title}</span>
            </div>
            <div style={{ padding: "14px 16px" }}>{children}</div>
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return <div style={{ color: "#6b7280", fontSize: "13px", fontStyle: "italic" }}>{text}</div>
}

function btnStyle(bg: string): React.CSSProperties {
    return {
        background: bg, border: "none", borderRadius: "8px",
        color: "white", cursor: "pointer",
        padding: "8px 16px", fontSize: "13px", fontWeight: 600,
    }
}
