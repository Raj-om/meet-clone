"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import type { InterviewMetrics, InterviewFlag, InterviewNote } from "@/hooks/useInterviewSession"
import { useMeetingTranscription } from "@/hooks/useMeetingTranscription"
import { useMeetingMinutes } from "@/hooks/useMeetingMinutes"
import { exportToPDF, exportToExcel } from "@/utils/reportGenerator"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    isHost: boolean
    metrics: InterviewMetrics
    flags: InterviewFlag[]
    notes: InterviewNote[]
    interviewDuration: number    // ms
    addFlag: (type: InterviewFlag["type"], note: string) => void
    addNote: (text: string) => void
    removeFlag: (id: string) => void
    transcript?: string
    getReportData: () => object
}

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
    bg:         "#0f172a",
    bgCard:     "rgba(15,23,42,0.85)",
    bgCardAlt:  "rgba(30,41,59,0.80)",
    border:     "rgba(20,184,166,0.18)",
    borderSoft: "rgba(148,163,184,0.12)",
    teal:       "#14b8a6",
    tealDark:   "#0d9488",
    tealFaint:  "rgba(20,184,166,0.12)",
    blue:       "#38bdf8",
    blueFaint:  "rgba(56,189,248,0.12)",
    green:      "#4ade80",
    greenFaint: "rgba(74,222,128,0.12)",
    amber:      "#fbbf24",
    amberFaint: "rgba(251,191,36,0.12)",
    red:        "#f87171",
    redFaint:   "rgba(248,113,113,0.12)",
    purple:     "#a78bfa",
    purpleFaint:"rgba(167,139,250,0.12)",
    textPri:    "#f1f5f9",
    textSec:    "#94a3b8",
    textMuted:  "#475569",
    glow: (color: string) => `0 0 24px ${color}40, 0 0 8px ${color}20`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function formatMs(ms: number): string {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}m ${s}s`
}

function flagIcon(type: InterviewFlag["type"]): string {
    switch (type) {
        case "inconsistency": return "🔴"
        case "nervousness":   return "🟡"
        case "avoidance":     return "🟠"
        case "custom":        return "⚪"
    }
}

function flagColor(type: InterviewFlag["type"]): string {
    switch (type) {
        case "inconsistency": return C.red
        case "nervousness":   return C.amber
        case "avoidance":     return "#fb923c"
        case "custom":        return C.textSec
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated SVG Ring Meter
// ─────────────────────────────────────────────────────────────────────────────

interface RingMeterProps {
    value: number        // 0-100
    label: string
    color: string
    size?: number
    strokeWidth?: number
    inverted?: boolean   // for stress: lower is better, ring fills from green→red
    sublabel?: string
}

function RingMeter({ value, label, color, size = 110, strokeWidth = 9, inverted = false, sublabel }: RingMeterProps) {
    const radius     = (size - strokeWidth * 2) / 2
    const circ       = 2 * Math.PI * radius
    const clampedVal = Math.max(0, Math.min(100, value))
    const pct        = clampedVal / 100

    // For inverted (stress), color shifts from green→amber→red
    const ringColor = inverted
        ? (value <= 30 ? C.green : value <= 60 ? C.amber : C.red)
        : color

    const dashRef       = useRef<SVGCircleElement>(null)
    const animFrameRef  = useRef<number>(0)
    const currentPctRef = useRef<number>(0)

    useEffect(() => {
        const target = pct
        const duration = 900
        const start    = performance.now()
        const from     = currentPctRef.current

        cancelAnimationFrame(animFrameRef.current)

        function animate(now: number) {
            const elapsed = now - start
            const progress = Math.min(1, elapsed / duration)
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            const current = from + (target - from) * eased
            currentPctRef.current = current

            if (dashRef.current) {
                const offset = circ * (1 - current)
                dashRef.current.style.strokeDashoffset = String(offset)
            }

            if (progress < 1) {
                animFrameRef.current = requestAnimationFrame(animate)
            }
        }

        animFrameRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(animFrameRef.current)
    }, [pct, circ])

    const cx = size / 2
    const cy = size / 2

    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
        }}>
            <div style={{ position: "relative", width: size, height: size }}>
                {/* Glow layer */}
                <svg
                    width={size} height={size}
                    style={{ position: "absolute", top: 0, left: 0, filter: `drop-shadow(0 0 10px ${ringColor}60)` }}
                >
                    <circle
                        ref={dashRef}
                        cx={cx} cy={cy} r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circ}
                        strokeDashoffset={circ * (1 - pct)}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{ transition: "stroke 0.5s ease" }}
                    />
                </svg>

                {/* Track ring */}
                <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
                    <circle
                        cx={cx} cy={cy} r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={strokeWidth}
                    />
                </svg>

                {/* Value text */}
                <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                }}>
                    <span style={{
                        fontSize: "22px", fontWeight: 700, color: ringColor,
                        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px",
                        lineHeight: 1,
                    }}>
                        {clampedVal}
                    </span>
                    <span style={{ fontSize: "10px", color: C.textMuted, fontWeight: 500 }}>/ 100</span>
                </div>
            </div>

            {/* Label */}
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: C.textPri, lineHeight: 1.2 }}>{label}</div>
                {sublabel && (
                    <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "2px" }}>{sublabel}</div>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Speaking Ratio Bar
// ─────────────────────────────────────────────────────────────────────────────

function SpeakingRatioBar({ speakingTimeMs, totalMs }: { speakingTimeMs: number; totalMs: number }) {
    const pct = totalMs > 0 ? Math.min(100, Math.round((speakingTimeMs / totalMs) * 100)) : 0
    const barFillRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (barFillRef.current) {
            barFillRef.current.style.width = `${pct}%`
        }
    }, [pct])

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: C.teal, fontWeight: 600 }}>
                    🎤 Candidate — {formatMs(speakingTimeMs)} ({pct}%)
                </span>
                <span style={{ fontSize: "12px", color: C.textSec, fontWeight: 500 }}>
                    Interviewer — {pct < 100 ? formatMs(totalMs - speakingTimeMs) : "—"} ({100 - pct}%)
                </span>
            </div>

            <div style={{
                height: "10px", borderRadius: "99px",
                background: "rgba(255,255,255,0.07)", overflow: "hidden",
                position: "relative",
            }}>
                {/* Candidate fill (teal) */}
                <div ref={barFillRef} style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${C.teal}, ${C.blue})`,
                    borderRadius: "99px",
                    transition: "width 0.8s cubic-bezier(0.25,0.46,0.45,0.94)",
                }} />
            </div>

            <div style={{
                display: "flex", justifyContent: "space-between",
                marginTop: "6px", fontSize: "10px", color: C.textMuted,
            }}>
                <span>Ideal candidate speaking: 60–70%</span>
                <span>{pct > 70 ? "⚠️ Candidate over-talking" : pct < 30 ? "⚠️ Too quiet" : "✅ Balanced"}</span>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Card Wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: "16px",
            padding: "20px 22px",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            ...style,
        }}>
            {children}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "18px" }}>{icon}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: C.textPri, letterSpacing: "0.03em" }}>
                {title}
            </span>
            {badge && (
                <span style={{
                    marginLeft: "auto", fontSize: "11px", fontWeight: 600,
                    color: C.teal, background: C.tealFaint,
                    padding: "2px 10px", borderRadius: "99px",
                    border: `1px solid ${C.border}`,
                }}>
                    {badge}
                </span>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────

function Divider() {
    return <div style={{ height: "1px", background: C.borderSoft, margin: "0 -22px" }} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Flag Timeline Item
// ─────────────────────────────────────────────────────────────────────────────

function FlagItem({ flag, onRemove }: { flag: InterviewFlag; onRemove: () => void }) {
    const [hovered, setHovered] = useState(false)
    const color = flagColor(flag.type)

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "10px 12px", borderRadius: "10px",
                background: hovered ? `${color}10` : "rgba(255,255,255,0.03)",
                border: `1px solid ${hovered ? `${color}30` : C.borderSoft}`,
                transition: "all 0.2s ease",
            }}
        >
            <span style={{ fontSize: "15px", flexShrink: 0, marginTop: "1px" }}>{flagIcon(flag.type)}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <span style={{
                        fontSize: "10px", fontWeight: 700, color: color,
                        textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>
                        {flag.type}
                    </span>
                    <span style={{
                        fontSize: "10px", color: C.teal, fontWeight: 600,
                        background: C.tealFaint, padding: "1px 7px", borderRadius: "99px",
                        border: `1px solid ${C.border}`,
                        fontVariantNumeric: "tabular-nums",
                    }}>
                        {flag.timeCode}
                    </span>
                </div>
                <div style={{ fontSize: "12px", color: C.textSec, lineHeight: 1.5, wordBreak: "break-word" }}>
                    {flag.note}
                </div>
            </div>

            <button
                onClick={onRemove}
                title="Remove flag"
                style={{
                    flexShrink: 0, background: "none", border: "none",
                    color: C.textMuted, cursor: "pointer", fontSize: "14px",
                    padding: "2px 4px", borderRadius: "4px",
                    transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = C.red)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
            >
                ✕
            </button>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Note Item
// ─────────────────────────────────────────────────────────────────────────────

function NoteItem({ note }: { note: InterviewNote }) {
    return (
        <div style={{
            padding: "10px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.borderSoft}`,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: C.textMuted }}>📝</span>
                <span style={{
                    fontSize: "10px", fontWeight: 600, color: C.teal,
                    background: C.tealFaint, padding: "1px 7px", borderRadius: "99px",
                    border: `1px solid ${C.border}`,
                    fontVariantNumeric: "tabular-nums",
                }}>
                    {note.timeCode}
                </span>
            </div>
            <div style={{ fontSize: "12px", color: C.textSec, lineHeight: 1.5 }}>
                {note.text}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Suggested Questions
// ─────────────────────────────────────────────────────────────────────────────

const STATIC_SUGGESTIONS = [
    "Can you elaborate on your experience with that technology in a production environment?",
    "How did you handle disagreements with your team lead during that project?",
    "Walk me through a time you failed and what you learned from it.",
]

function AISuggestions({ transcript }: { transcript?: string }) {
    // In a real integration: parse transcript keywords → generate contextual suggestions
    const questions = transcript
        ? STATIC_SUGGESTIONS  // Replace with NLP-derived questions in production
        : STATIC_SUGGESTIONS

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {questions.map((q, i) => (
                <div key={i} style={{
                    display: "flex", gap: "12px", alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: "10px",
                    background: "linear-gradient(135deg, rgba(167,139,250,0.07) 0%, rgba(20,184,166,0.05) 100%)",
                    border: `1px solid rgba(167,139,250,0.18)`,
                }}>
                    <span style={{
                        flexShrink: 0, width: "22px", height: "22px",
                        borderRadius: "50%", background: C.purpleFaint,
                        border: `1px solid rgba(167,139,250,0.3)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "11px", fontWeight: 700, color: C.purple,
                    }}>
                        {i + 1}
                    </span>
                    <span style={{ fontSize: "12px", color: C.textSec, lineHeight: 1.6, fontStyle: "italic" }}>
                        &ldquo;{q}&rdquo;
                    </span>
                </div>
            ))}
            <p style={{ fontSize: "10px", color: C.textMuted, margin: 0, textAlign: "center" }}>
                ✨ AI-generated from session transcript — refine based on candidate responses
            </p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate View (minimal, no scores)
// ─────────────────────────────────────────────────────────────────────────────

function CandidateView({ interviewDuration }: { interviewDuration: number }) {
    const [pulse, setPulse] = useState(false)

    useEffect(() => {
        const id = setInterval(() => setPulse(p => !p), 1500)
        return () => clearInterval(id)
    }, [])

    return (
        <div style={{
            minHeight: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "28px",
            padding: "40px 24px",
            background: `radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.08) 0%, transparent 60%)`,
        }}>
            {/* Pulse Banner */}
            <div style={{
                display: "flex", alignItems: "center", gap: "16px",
                padding: "24px 40px", borderRadius: "20px",
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                backdropFilter: "blur(20px)",
                boxShadow: `0 0 40px rgba(20,184,166,0.12)`,
            }}>
                <div style={{
                    width: "14px", height: "14px", borderRadius: "50%",
                    background: C.teal,
                    boxShadow: pulse ? C.glow(C.teal) : "none",
                    transition: "box-shadow 0.5s ease",
                }} />
                <div>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: C.textPri, letterSpacing: "-0.3px" }}>
                        🎤 Interview in Progress
                    </div>
                    <div style={{ fontSize: "14px", color: C.textSec, marginTop: "4px" }}>
                        Stay focused, speak clearly and confidently
                    </div>
                </div>
            </div>

            {/* Timer */}
            <div style={{
                padding: "20px 48px", borderRadius: "16px",
                background: C.bgCard,
                border: `1px solid ${C.borderSoft}`,
                backdropFilter: "blur(12px)",
                textAlign: "center",
            }}>
                <div style={{ fontSize: "11px", color: C.textMuted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                    Session Duration
                </div>
                <div style={{
                    fontSize: "42px", fontWeight: 800, color: C.teal,
                    fontVariantNumeric: "tabular-nums", letterSpacing: "-2px",
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                }}>
                    {formatDuration(interviewDuration)}
                </div>
            </div>

            {/* Eye Contact Tip Card */}
            <div style={{
                maxWidth: "400px", width: "100%",
                padding: "20px 24px", borderRadius: "16px",
                background: `linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(20,184,166,0.08) 100%)`,
                border: `1px solid rgba(56,189,248,0.20)`,
                backdropFilter: "blur(12px)",
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                    <span style={{ fontSize: "24px" }}>👁️</span>
                    <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: C.blue, marginBottom: "6px" }}>
                            Eye Contact Tip
                        </div>
                        <div style={{ fontSize: "13px", color: C.textSec, lineHeight: 1.6 }}>
                            <strong style={{ color: C.textPri }}>Look at the camera</strong>, not the screen.
                            This creates genuine eye contact with your interviewer and conveys confidence.
                        </div>
                    </div>
                </div>
            </div>

            {/* Posture Tip */}
            <div style={{
                maxWidth: "400px", width: "100%",
                padding: "18px 22px", borderRadius: "14px",
                background: `linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(20,184,166,0.05) 100%)`,
                border: `1px solid rgba(167,139,250,0.18)`,
                backdropFilter: "blur(12px)",
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                    <span style={{ fontSize: "22px" }}>🧘</span>
                    <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: C.purple, marginBottom: "6px" }}>
                            Stay Calm &amp; Measured
                        </div>
                        <div style={{ fontSize: "13px", color: C.textSec, lineHeight: 1.6 }}>
                            Breathe steadily. Pause briefly before answering to collect your thoughts.
                            Silence is a sign of composure, not weakness.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Host / Interviewer View
// ─────────────────────────────────────────────────────────────────────────────

function HostView({ metrics, flags, notes, interviewDuration, addFlag, addNote, removeFlag, transcript, getReportData }: Omit<Props, "isHost">) {
    const [flagInput, setFlagInput]   = useState("")
    const [noteInput, setNoteInput]   = useState("")
    const [customFlag, setCustomFlag] = useState(false)
    const flagsEndRef = useRef<HTMLDivElement>(null)
    const minutesRef = useRef<HTMLDivElement>(null)

    // AI Transcription & Summarization
    const { isListening, startListening, stopListening, transcript: liveTranscript, currentUtterance } = useMeetingTranscription()
    const { isGenerating, minutes, error: aiError, generateMinutes } = useMeetingMinutes()

    // Auto-scroll flags
    useEffect(() => {
        flagsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [flags.length])

    const handleAddFlag = (type: InterviewFlag["type"]) => {
        if (type === "custom") {
            if (!flagInput.trim()) { setCustomFlag(true); return }
            addFlag("custom", flagInput)
            setFlagInput("")
            setCustomFlag(false)
        } else {
            addFlag(type, "")
        }
    }

    const handleAddNote = () => {
        if (!noteInput.trim()) return
        addNote(noteInput)
        setNoteInput("")
    }

    const saveMetrics = async () => {
        try {
            const data: any = getReportData()
            if (!data || !data.metrics) return

            await fetch("/api/metrics/interview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    meetingId: window.location.pathname.split('/').pop(),
                    candidateId: "candidate-1", // In real app, passed via props or session
                    candidateName: "Interview Candidate",
                    confidenceScore: data.metrics.confidenceScore,
                    stressLevel: data.metrics.voiceStressLevel,
                    flags: data.flags || []
                })
            })
            alert("Interview metrics permanently saved to cloud database!")
        } catch (e) {
            console.error("Failed to save metrics", e)
        }
    }

    const handleDownloadPDF = () => {
        const data: any = getReportData()
        if (!data || !data.metrics) return
        
        const columns = ["Metric", "Value"]
        const rows = [
            ["Confidence Score", `${Math.round(data.metrics.confidenceScore)}%`],
            ["Eye Contact", `${Math.round(data.metrics.eyeContactPercent)}%`],
            ["Voice Stress", `${Math.round(data.metrics.voiceStressLevel)}%`],
            ["Speaking Time", `${Math.round(data.metrics.speakingTimeMs / 1000)}s`],
            ["Silence Periods", `${data.metrics.silencePeriods}`]
        ]
        
        exportToPDF("Interview Scorecard", columns, rows, `interview-scorecard-${Date.now()}`)
    }

    const handleDownloadExcel = () => {
        const data: any = getReportData()
        if (!data || !data.flags) return
        
        const flatData = data.flags.map((f: any) => ({
            "Time Code": f.timeCode,
            "Type": f.type,
            "Note": f.note
        }))
        
        exportToExcel("Interview Flags Report", flatData, `interview-flags-${Date.now()}`)
    }

    const overallScore = metrics.confidenceScore

    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: "16px",
            padding: "16px", overflowY: "auto", height: "100%",
        }}>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 4px",
            }}>
                <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: C.textPri, letterSpacing: "-0.3px" }}>
                        📋 Interview Monitor
                    </div>
                    <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "2px" }}>
                        Real-time candidate analysis
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Live indicator */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "5px 12px", borderRadius: "99px",
                        background: "rgba(74,222,128,0.10)",
                        border: "1px solid rgba(74,222,128,0.25)",
                    }}>
                        <div style={{
                            width: "7px", height: "7px", borderRadius: "50%",
                            background: C.green,
                            animation: "pulse-dot 1.5s ease-in-out infinite",
                        }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: C.green }}>LIVE</span>
                    </div>

                    {/* Duration */}
                    <div style={{
                        fontSize: "13px", fontWeight: 700,
                        color: C.teal, fontVariantNumeric: "tabular-nums",
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        background: C.tealFaint, padding: "5px 12px", borderRadius: "99px",
                        border: `1px solid ${C.border}`,
                    }}>
                        {formatDuration(interviewDuration)}
                    </div>
                </div>
            </div>

            {/* ── Candidate Scorecard ─────────────────────────────────────── */}
            <Card style={{
                background: `linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(20,184,166,0.05) 100%)`,
                boxShadow: `0 4px 32px rgba(0,0,0,0.45), 0 0 0 1px ${C.border}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}>
                <SectionHeader icon="🏆" title="Candidate Scorecard" badge={
                    overallScore >= 80 ? "Excellent" :
                    overallScore >= 60 ? "Good" :
                    overallScore >= 40 ? "Fair" : "Needs Work"
                } />

                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "12px", justifyItems: "center",
                }}>
                    <RingMeter
                        value={metrics.eyeContactPercent}
                        label="Eye Contact"
                        sublabel="Camera focus"
                        color={C.blue}
                    />
                    <RingMeter
                        value={Math.max(0, 100 - metrics.voiceStressLevel)}
                        label="Voice Confidence"
                        sublabel="Calm & steady"
                        color={C.green}
                    />
                    <RingMeter
                        value={metrics.voiceStressLevel}
                        label="Stress Level"
                        sublabel="Lower = better"
                        color={C.amber}
                        inverted
                    />
                    <RingMeter
                        value={metrics.confidenceScore}
                        label="Overall Score"
                        sublabel="Composite"
                        color={C.purple}
                        size={118}
                        strokeWidth={10}
                    />
                </div>

                {/* Sub-stats row */}
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px", marginTop: "18px",
                }}>
                    {[
                        { icon: "🎤", label: "Speaking Time", value: formatMs(metrics.speakingTimeMs), color: C.teal },
                        { icon: "🤫", label: "Silence Periods", value: `${metrics.silencePeriods} pauses`, color: metrics.silencePeriods >= 4 ? C.red : C.textSec },
                        { icon: "🚩", label: "Flags Raised", value: `${metrics.flags.length} flags`, color: metrics.flags.length >= 3 ? C.amber : C.textSec },
                    ].map(({ icon, label, value, color }) => (
                        <div key={label} style={{
                            textAlign: "center", padding: "10px 12px",
                            borderRadius: "10px", background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${C.borderSoft}`,
                        }}>
                            <div style={{ fontSize: "16px", marginBottom: "4px" }}>{icon}</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color, marginBottom: "2px" }}>
                                {value}
                            </div>
                            <div style={{ fontSize: "10px", color: C.textMuted }}>{label}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* ── Speaking Time Analysis ──────────────────────────────────── */}
            <Card>
                <SectionHeader icon="📊" title="Speaking Time Analysis" />
                <SpeakingRatioBar
                    speakingTimeMs={metrics.speakingTimeMs}
                    totalMs={interviewDuration}
                />
            </Card>

            {/* ── Flag Timeline ───────────────────────────────────────────── */}
            <Card>
                <SectionHeader icon="🚩" title="Flag Timeline" badge={`${flags.length}`} />

                {/* Quick-add buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                    {(["inconsistency", "nervousness", "avoidance"] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => handleAddFlag(type)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "8px", border: `1px solid ${flagColor(type)}40`,
                                background: `${flagColor(type)}12`,
                                color: flagColor(type),
                                fontSize: "11px", fontWeight: 600, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "5px",
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = `${flagColor(type)}25`
                                e.currentTarget.style.borderColor = `${flagColor(type)}70`
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = `${flagColor(type)}12`
                                e.currentTarget.style.borderColor = `${flagColor(type)}40`
                            }}
                        >
                            {flagIcon(type)} + {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                    <button
                        onClick={() => setCustomFlag(f => !f)}
                        style={{
                            padding: "6px 14px",
                            borderRadius: "8px", border: `1px solid ${C.borderSoft}`,
                            background: customFlag ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                            color: C.textSec,
                            fontSize: "11px", fontWeight: 600, cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        ⚪ + Custom
                    </button>
                </div>

                {/* Custom flag input */}
                {customFlag && (
                    <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                        <input
                            value={flagInput}
                            onChange={e => setFlagInput(e.target.value)}
                            placeholder="Describe the observation…"
                            onKeyDown={e => e.key === "Enter" && handleAddFlag("custom")}
                            style={{
                                flex: 1, padding: "9px 14px", borderRadius: "10px",
                                background: "rgba(255,255,255,0.06)",
                                border: `1px solid ${C.borderSoft}`,
                                color: C.textPri, fontSize: "12px", outline: "none",
                            }}
                        />
                        <button
                            onClick={() => handleAddFlag("custom")}
                            style={{
                                padding: "9px 16px", borderRadius: "10px",
                                background: C.tealFaint, border: `1px solid ${C.border}`,
                                color: C.teal, fontSize: "12px", fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Add
                        </button>
                    </div>
                )}

                <Divider />
                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
                    {flags.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px", color: C.textMuted, fontSize: "12px" }}>
                            No flags raised yet. Use the buttons above to mark notable moments.
                        </div>
                    ) : (
                        flags.map(flag => (
                            <FlagItem
                                key={flag.id}
                                flag={flag}
                                onRemove={() => removeFlag(flag.id)}
                            />
                        ))
                    )}
                    <div ref={flagsEndRef} />
                </div>
            </Card>

            {/* ── Interview Notes ─────────────────────────────────────────── */}
            <Card>
                <SectionHeader icon="📝" title="Interview Notes" badge={`${notes.length}`} />

                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        placeholder="Type a note about the candidate's response…"
                        rows={2}
                        onKeyDown={e => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote()
                        }}
                        style={{
                            flex: 1, padding: "10px 14px", borderRadius: "10px",
                            background: "rgba(255,255,255,0.06)",
                            border: `1px solid ${C.borderSoft}`,
                            color: C.textPri, fontSize: "12px", outline: "none",
                            resize: "none", lineHeight: 1.5,
                            fontFamily: "inherit",
                        }}
                    />
                    <button
                        onClick={handleAddNote}
                        style={{
                            padding: "10px 16px", borderRadius: "10px",
                            background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
                            border: "none",
                            color: "#fff", fontSize: "12px", fontWeight: 700,
                            cursor: "pointer", alignSelf: "flex-end",
                            boxShadow: C.glow(C.teal),
                        }}
                    >
                        Add
                    </button>
                </div>

                <div style={{ fontSize: "10px", color: C.textMuted, marginBottom: "12px" }}>
                    Tip: Press <kbd style={{ padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", fontSize: "9px" }}>Ctrl+Enter</kbd> to add quickly
                </div>

                <Divider />
                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "220px", overflowY: "auto" }}>
                    {notes.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", color: C.textMuted, fontSize: "12px" }}>
                            No notes yet. Jot down key observations as the interview progresses.
                        </div>
                    ) : (
                        notes.map(note => <NoteItem key={note.id} note={note} />)
                    )}
                </div>
            </Card>

            {/* ── AI Transcription & Meeting Minutes ────────────────────── */}
            <Card style={{
                background: `linear-gradient(135deg, rgba(79,70,229,0.07) 0%, rgba(124,58,237,0.07) 100%)`,
                border: `1px solid rgba(124,58,237,0.20)`,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <SectionHeader icon="🎙️" title="AI Transcription" />
                    <button onClick={isListening ? stopListening : startListening} style={{
                        background: isListening ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                        border: `1px solid ${isListening ? "#ef4444" : "#10b981"}`,
                        color: isListening ? "#fca5a5" : "#6ee7b7",
                        padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                    }}>
                        {isListening ? "🛑 Stop Listening" : "▶ Start Captions"}
                    </button>
                </div>

                {(liveTranscript || currentUtterance) && (
                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "12px", maxHeight: "120px", overflowY: "auto", fontSize: "12px", color: "#d1d5db", lineHeight: "1.5", fontStyle: "italic", marginBottom: "14px", border: `1px solid ${C.borderSoft}` }}>
                        {liveTranscript} <span style={{ color: "white" }}>{currentUtterance}</span>
                    </div>
                )}

                <button 
                    onClick={() => generateMinutes(liveTranscript)}
                    disabled={!liveTranscript || isGenerating}
                    style={{
                        width: "100%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white",
                        border: "none", borderRadius: "10px", padding: "12px", cursor: (!liveTranscript || isGenerating) ? "not-allowed" : "pointer",
                        fontSize: "13px", fontWeight: "700", opacity: (!liveTranscript || isGenerating) ? 0.6 : 1, transition: "all 0.2s",
                        boxShadow: (!liveTranscript || isGenerating) ? "none" : C.glow("#7c3aed")
                    }}>
                    {isGenerating ? "🧠 DeepSeek is generating minutes..." : "✨ Generate AI Meeting Minutes"}
                </button>

                {aiError && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "10px", textAlign: "center" }}>{aiError}</div>}
                
                {minutes && (
                    <div ref={minutesRef} style={{ marginTop: "14px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "10px", padding: "16px" }}>
                        <div style={{ fontSize: "13px", color: "white", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                            {minutes}
                        </div>
                    </div>
                )}
            </Card>

            {/* ── AI Suggested Questions ──────────────────────────────────── */}
            <Card style={{
                background: `linear-gradient(135deg, rgba(167,139,250,0.07) 0%, rgba(15,23,42,0.92) 60%)`,
                border: `1px solid rgba(167,139,250,0.20)`,
            }}>
                <SectionHeader icon="✨" title="AI Follow-up Suggestions" />
                <AISuggestions transcript={transcript} />
            </Card>

            {/* ── Download Report ── */}
            {/* ── Download Report ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button onClick={saveMetrics} style={{
                    width: "100%", padding: "14px", borderRadius: "12px",
                    background: `linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)`, border: "none",
                    color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                    boxShadow: `0 0 10px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.3)`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                }}>
                    💾 Save to Cloud Database
                </button>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={handleDownloadPDF} style={{
                        flex: 1, padding: "14px", borderRadius: "12px",
                        background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)`, border: "none",
                        color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                        boxShadow: `${C.glow(C.teal)}, 0 4px 16px rgba(0,0,0,0.3)`,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    }}>
                        📄 PDF Scorecard
                    </button>
                    <button onClick={handleDownloadExcel} style={{
                        flex: 1, padding: "14px", borderRadius: "12px",
                        background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`, border: "none",
                        color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                        boxShadow: `${C.glow("#10b981")}, 0 4px 16px rgba(0,0,0,0.3)`,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    }}>
                        📊 Excel Flags
                    </button>
                </div>
            </div>

            {/* CSS keyframes injected once */}
            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InterviewerDashboard({
    isHost,
    metrics,
    flags,
    notes,
    interviewDuration,
    addFlag,
    addNote,
    removeFlag,
    transcript,
    getReportData,
}: Props) {
    return (
        <div style={{
            width: "100%", height: "100%", minHeight: "100vh",
            background: C.bg,
            color: C.textPri,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
            overflowY: "auto",
            position: "relative",
        }}>
            {/* Subtle radial bg decoration */}
            <div style={{
                position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
                background: `
                    radial-gradient(ellipse at 10% 20%, rgba(20,184,166,0.07) 0%, transparent 50%),
                    radial-gradient(ellipse at 90% 80%, rgba(56,189,248,0.05) 0%, transparent 50%)
                `,
            }} />

            <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
                {isHost ? (
                    <HostView
                        metrics={metrics}
                        flags={flags}
                        notes={notes}
                        interviewDuration={interviewDuration}
                        addFlag={addFlag}
                        addNote={addNote}
                        removeFlag={removeFlag}
                        transcript={transcript}
                        getReportData={getReportData}
                    />
                ) : (
                    <CandidateView interviewDuration={interviewDuration} />
                )}
            </div>
        </div>
    )
}
