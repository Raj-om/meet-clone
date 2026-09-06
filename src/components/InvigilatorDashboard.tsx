"use client"

import React, { useState, useCallback, useMemo } from "react"
import type {
    ExamState,
    ExamQuestion,
    StudentViolation,
    StudentExamStatus,
    ExamAnswers,
} from "@/hooks/useExamSession"
import { exportToPDF, exportToExcel } from "@/utils/reportGenerator"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    studentStatuses: Map<string, StudentExamStatus>
    violations: StudentViolation[]
    examState: ExamState
    examTimeRemaining: number
    startExam: (questions: ExamQuestion[], durationMinutes: number) => void
    endExam: () => void
    getGradedResults: () => { studentId: string; score: number; total: number; percentage: number }[]
}

interface QuestionDraft {
    id: string
    text: string
    type: 'mcq' | 'short_answer' | 'essay'
    options: [string, string, string, string]
    correctAnswer: string
    marks: number
    timeLimit: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
    bg:         "#0f0f1a",
    surface:    "#1a1a2e",
    surfaceHi:  "#16213e",
    glass:      "rgba(255,255,255,0.04)",
    border:     "rgba(255,255,255,0.08)",
    red:        "#dc2626",
    redHi:      "#ef4444",
    redGlow:    "rgba(220,38,38,0.25)",
    amber:      "#f59e0b",
    amberHi:    "#fbbf24",
    green:      "#16a34a",
    greenHi:    "#22c55e",
    blue:       "#2563eb",
    violet:     "#7c3aed",
    violetHi:   "#a78bfa",
    text:       "#f1f5f9",
    muted:      "#94a3b8",
    dim:        "#475569",
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function violationIcon(type: StudentViolation['type']): string {
    const map: Record<StudentViolation['type'], string> = {
        tab_switch:      "🔴",
        second_face:     "🟡",
        phone_detected:  "📱",
        left_frame:      "👤",
        eye_movement:    "👁️",
        fullscreen_exit: "⛶",
        hidden_ai_copilot: "🤖",
    }
    return map[type] ?? "⚠️"
}

function violationLabel(type: StudentViolation['type']): string {
    return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function scoreColor(pct: number): string {
    if (pct >= 80) return C.greenHi
    if (pct >= 50) return C.amber
    return C.redHi
}

function newDraft(): QuestionDraft {
    return {
        id: `q-${Date.now()}`,
        text: "",
        type: "mcq",
        options: ["", "", "", ""],
        correctAnswer: "",
        marks: 10,
        timeLimit: 0,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: C.glass,
            border: `1px solid ${C.border}`,
            borderRadius: "16px",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "20px",
            ...style,
        }}>
            {children}
        </div>
    )
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: "10px", fontWeight: 700,
            letterSpacing: "0.12em",
            color: C.dim, textTransform: "uppercase",
            marginBottom: "6px",
        }}>
            {children}
        </div>
    )
}

function Input({
    value, onChange, placeholder, style,
}: {
    value: string; onChange: (v: string) => void
    placeholder?: string; style?: React.CSSProperties
}) {
    return (
        <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                color: C.text,
                fontSize: "13px",
                padding: "8px 12px",
                outline: "none",
                fontFamily: "inherit",
                ...style,
            }}
        />
    )
}

function Btn({
    children, onClick, color = C.red, disabled = false, style,
}: {
    children: React.ReactNode; onClick: () => void
    color?: string; disabled?: boolean; style?: React.CSSProperties
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: disabled ? "#334155" : color,
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                fontFamily: "inherit",
                opacity: disabled ? 0.6 : 1,
                boxShadow: disabled ? "none" : `0 4px 12px ${color}55`,
                ...style,
            }}
        >
            {children}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Builder (shown in waiting state)
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBuilder({ onStart }: { onStart: (qs: ExamQuestion[], duration: number) => void }) {
    const [draft, setDraft] = useState<QuestionDraft>(newDraft())
    const [questions, setQuestions] = useState<ExamQuestion[]>([])
    const [duration, setDuration] = useState<number>(60)

    const updateDraft = (patch: Partial<QuestionDraft>) =>
        setDraft(prev => ({ ...prev, ...patch }))

    const updateOption = (i: number, val: string) => {
        const opts = [...draft.options] as [string, string, string, string]
        opts[i] = val
        setDraft(prev => ({ ...prev, options: opts }))
    }

    const addQuestion = () => {
        if (!draft.text.trim()) return
        const q: ExamQuestion = {
            id: draft.id,
            text: draft.text,
            type: draft.type,
            marks: draft.marks,
            ...(draft.type === "mcq" && {
                options: draft.options.filter(Boolean),
                correctAnswer: draft.correctAnswer,
            }),
            ...(draft.timeLimit > 0 && { timeLimit: draft.timeLimit }),
        }
        setQuestions(prev => [...prev, q])
        setDraft(newDraft())
    }

    const removeQuestion = (id: string) =>
        setQuestions(prev => prev.filter(q => q.id !== id))

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Question form */}
            <GlassCard>
                <div style={{ fontSize: "14px", fontWeight: 700, color: C.text, marginBottom: "16px" }}>
                    ✏️ Build a Question
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Question text */}
                    <div>
                        <Label>Question Text</Label>
                        <textarea
                            value={draft.text}
                            onChange={e => updateDraft({ text: e.target.value })}
                            placeholder="Enter question text..."
                            rows={3}
                            style={{
                                width: "100%", boxSizing: "border-box",
                                background: "rgba(255,255,255,0.05)",
                                border: `1px solid ${C.border}`,
                                borderRadius: "8px",
                                color: C.text,
                                fontSize: "13px",
                                padding: "10px 12px",
                                outline: "none",
                                fontFamily: "inherit",
                                resize: "vertical",
                            }}
                        />
                    </div>

                    {/* Type + Marks + TimeLimit row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                        <div>
                            <Label>Type</Label>
                            <select
                                value={draft.type}
                                onChange={e => updateDraft({ type: e.target.value as QuestionDraft['type'] })}
                                style={{
                                    width: "100%",
                                    background: "rgba(255,255,255,0.05)",
                                    border: `1px solid ${C.border}`,
                                    borderRadius: "8px",
                                    color: C.text,
                                    fontSize: "13px",
                                    padding: "8px 10px",
                                    outline: "none",
                                    cursor: "pointer",
                                }}
                            >
                                <option value="mcq" style={{ background: C.surface }}>MCQ</option>
                                <option value="short_answer" style={{ background: C.surface }}>Short Answer</option>
                                <option value="essay" style={{ background: C.surface }}>Essay</option>
                            </select>
                        </div>
                        <div>
                            <Label>Marks</Label>
                            <input
                                type="number" min={1} value={draft.marks}
                                onChange={e => updateDraft({ marks: Number(e.target.value) })}
                                style={{
                                    width: "100%", boxSizing: "border-box",
                                    background: "rgba(255,255,255,0.05)",
                                    border: `1px solid ${C.border}`,
                                    borderRadius: "8px",
                                    color: C.text, fontSize: "13px",
                                    padding: "8px 10px", outline: "none",
                                }}
                            />
                        </div>
                        <div>
                            <Label>Time Limit (s, 0=none)</Label>
                            <input
                                type="number" min={0} value={draft.timeLimit}
                                onChange={e => updateDraft({ timeLimit: Number(e.target.value) })}
                                style={{
                                    width: "100%", boxSizing: "border-box",
                                    background: "rgba(255,255,255,0.05)",
                                    border: `1px solid ${C.border}`,
                                    borderRadius: "8px",
                                    color: C.text, fontSize: "13px",
                                    padding: "8px 10px", outline: "none",
                                }}
                            />
                        </div>
                    </div>

                    {/* MCQ options */}
                    {draft.type === "mcq" && (
                        <div>
                            <Label>Options &amp; Correct Answer</Label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {draft.options.map((opt, i) => (
                                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                        <input
                                            type="radio"
                                            name="correct"
                                            checked={draft.correctAnswer === opt && opt !== ""}
                                            onChange={() => opt && updateDraft({ correctAnswer: opt })}
                                            style={{ accentColor: C.green, cursor: "pointer" }}
                                        />
                                        <Input
                                            value={opt}
                                            onChange={v => updateOption(i, v)}
                                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                        />
                                    </div>
                                ))}
                                {draft.correctAnswer && (
                                    <div style={{ fontSize: "11px", color: C.greenHi, marginTop: "2px" }}>
                                        ✓ Correct answer: <strong>{draft.correctAnswer}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Btn onClick={addQuestion} color={C.violet} disabled={!draft.text.trim()}>
                        + Add Question
                    </Btn>
                </div>
            </GlassCard>

            {/* Question list */}
            {questions.length > 0 && (
                <GlassCard>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: C.text, marginBottom: "12px" }}>
                        📋 Questions ({questions.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                        {questions.map((q, i) => (
                            <div key={q.id} style={{
                                display: "flex", alignItems: "flex-start", gap: "10px",
                                background: "rgba(255,255,255,0.04)",
                                borderRadius: "10px", padding: "10px 14px",
                                border: `1px solid ${C.border}`,
                            }}>
                                <div style={{
                                    minWidth: "24px", height: "24px",
                                    borderRadius: "50%",
                                    background: C.violet + "40",
                                    border: `1px solid ${C.violet}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "11px", fontWeight: 700, color: C.violetHi,
                                }}>
                                    {i + 1}
                                </div>
                                <div style={{ flex: 1, fontSize: "12px", color: C.muted }}>
                                    <span style={{ color: C.text, fontWeight: 600 }}>{q.text}</span>
                                    <span style={{
                                        marginLeft: "8px",
                                        padding: "1px 6px", borderRadius: "4px",
                                        background: C.violet + "30", color: C.violetHi,
                                        fontSize: "10px",
                                    }}>{q.type}</span>
                                    <span style={{ marginLeft: "6px", color: C.amber }}>{q.marks}pts</span>
                                </div>
                                <button
                                    onClick={() => removeQuestion(q.id)}
                                    style={{
                                        background: "transparent", border: "none",
                                        color: C.dim, cursor: "pointer", fontSize: "16px",
                                        padding: "0 4px", transition: "color 0.15s",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = C.redHi)}
                                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Duration + Start */}
            <GlassCard>
                <Label>Exam Duration</Label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    {[30, 45, 60, 90, 120].map(d => (
                        <button
                            key={d}
                            onClick={() => setDuration(d)}
                            style={{
                                flex: 1,
                                padding: "8px 4px",
                                borderRadius: "8px",
                                border: `1px solid ${duration === d ? C.amber : C.border}`,
                                background: duration === d ? C.amber + "20" : "transparent",
                                color: duration === d ? C.amberHi : C.muted,
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: "12px",
                                transition: "all 0.15s",
                            }}
                        >
                            {d}m
                        </button>
                    ))}
                </div>
                <Btn
                    onClick={() => onStart(questions, duration)}
                    color={C.red}
                    disabled={questions.length === 0}
                    style={{ width: "100%" }}
                >
                    🚀 Launch Exam — {questions.length} Question{questions.length !== 1 ? "s" : ""} · {duration} min
                </Btn>
            </GlassCard>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Violation Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

function ViolationModal({
    status, onClose,
}: { status: StudentExamStatus; onClose: () => void }) {
    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.75)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 9999,
                backdropFilter: "blur(4px)",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: "20px",
                    padding: "28px",
                    width: "480px",
                    maxWidth: "95vw",
                    maxHeight: "80vh",
                    overflowY: "auto",
                    boxShadow: `0 0 60px ${C.redGlow}`,
                }}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div>
                        <div style={{ color: C.text, fontWeight: 700, fontSize: "16px" }}>
                            {status.displayName}
                        </div>
                        <div style={{ color: C.muted, fontSize: "12px" }}>
                            {status.violations.length} violation{status.violations.length !== 1 ? "s" : ""} detected
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent", border: `1px solid ${C.border}`,
                            borderRadius: "8px", color: C.muted,
                            padding: "4px 10px", cursor: "pointer", fontSize: "16px",
                        }}
                    >×</button>
                </div>

                {/* Violations list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {status.violations.length === 0 ? (
                        <div style={{ color: C.dim, fontSize: "13px", textAlign: "center", padding: "20px" }}>
                            No violations recorded.
                        </div>
                    ) : (
                        status.violations.map((v, idx) => (
                            <div key={idx} style={{
                                background: "rgba(220,38,38,0.08)",
                                border: `1px solid rgba(220,38,38,0.2)`,
                                borderRadius: "10px",
                                padding: "12px 14px",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: C.redHi }}>
                                        {violationIcon(v.type)} {violationLabel(v.type)}
                                    </span>
                                    <span style={{ fontSize: "11px", color: C.dim }}>
                                        {new Date(v.timestamp).toLocaleTimeString([], {
                                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <div style={{ fontSize: "12px", color: C.muted }}>{v.description}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Card
// ─────────────────────────────────────────────────────────────────────────────

function StudentCard({
    status, onClick,
}: { status: StudentExamStatus; onClick: () => void }) {
    const hasViolations = status.violations.length > 0
    const progressPct = status.totalQuestions > 0
        ? (status.answeredCount / status.totalQuestions) * 100 : 0

    const stateConfig: Record<ExamState, { label: string; color: string }> = {
        waiting:   { label: "Waiting",   color: C.dim },
        active:    { label: "In Exam",   color: C.greenHi },
        submitted: { label: "Submitted", color: C.violet },
        reviewing: { label: "Reviewing", color: C.amber },
    }
    const cfg = stateConfig[status.state]

    return (
        <div
            onClick={onClick}
            style={{
                background: hasViolations
                    ? `linear-gradient(135deg, rgba(220,38,38,0.12), rgba(26,26,46,0.9))`
                    : C.glass,
                border: `1px solid ${hasViolations ? "rgba(220,38,38,0.4)" : C.border}`,
                borderRadius: "14px",
                padding: "16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                backdropFilter: "blur(8px)",
                boxShadow: hasViolations
                    ? `0 0 20px rgba(220,38,38,0.2), 0 4px 16px rgba(0,0,0,0.3)`
                    : "0 4px 16px rgba(0,0,0,0.2)",
                position: "relative",
                overflow: "hidden",
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.boxShadow = hasViolations
                    ? `0 0 30px rgba(220,38,38,0.35), 0 8px 24px rgba(0,0,0,0.4)`
                    : `0 8px 24px rgba(0,0,0,0.35)`
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = hasViolations
                    ? `0 0 20px rgba(220,38,38,0.2), 0 4px 16px rgba(0,0,0,0.3)`
                    : "0 4px 16px rgba(0,0,0,0.2)"
            }}
        >
            {/* Violation badge */}
            {hasViolations && (
                <div style={{
                    position: "absolute", top: "10px", right: "10px",
                    background: C.red,
                    color: "white",
                    borderRadius: "50%",
                    width: "22px", height: "22px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 700,
                    boxShadow: `0 0 8px ${C.redGlow}`,
                }}>
                    {status.violations.length}
                </div>
            )}

            {/* Avatar + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.violet}, ${C.red})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: 700, color: "white",
                    flexShrink: 0,
                }}>
                    {status.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: "hidden" }}>
                    <div style={{
                        color: C.text, fontWeight: 700, fontSize: "13px",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                        {status.displayName}
                    </div>
                    <div style={{
                        display: "inline-block",
                        padding: "1px 7px", borderRadius: "10px",
                        background: cfg.color + "25",
                        border: `1px solid ${cfg.color}50`,
                        color: cfg.color,
                        fontSize: "10px", fontWeight: 700,
                        marginTop: "2px",
                    }}>
                        {cfg.label}
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: C.muted, marginBottom: "4px" }}>
                    <span>Progress</span>
                    <span style={{ fontWeight: 700, color: C.text }}>
                        {status.answeredCount}/{status.totalQuestions}
                    </span>
                </div>
                <div style={{
                    height: "4px", borderRadius: "2px",
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        width: `${progressPct}%`,
                        background: `linear-gradient(90deg, ${C.violet}, ${C.redHi})`,
                        borderRadius: "2px",
                        transition: "width 0.4s ease",
                    }} />
                </div>
            </div>

            {hasViolations && (
                <div style={{ fontSize: "10px", color: C.redHi, display: "flex", alignItems: "center", gap: "4px" }}>
                    ⚠️ Click to review violations
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InvigilatorDashboard({
    studentStatuses,
    violations,
    examState,
    examTimeRemaining,
    startExam,
    endExam,
    getGradedResults,
}: Props) {
    const [selectedStudent, setSelectedStudent] = useState<StudentExamStatus | null>(null)

    const isLowTime = examTimeRemaining < 300  // < 5 min
    const timerColor = isLowTime ? C.redHi : C.amberHi

    const stateBadge: Record<ExamState, { label: string; bg: string; color: string }> = {
        waiting:   { label: "WAITING",  bg: C.dim + "30",   color: C.muted },
        active:    { label: "🔴 LIVE",  bg: C.red + "25",   color: C.redHi },
        submitted: { label: "ENDED",    bg: C.dim + "30",   color: C.muted },
        reviewing: { label: "REVIEWING",bg: C.violet + "25",color: C.violetHi },
    }
    const badge = stateBadge[examState]

    const students = useMemo(() => Array.from(studentStatuses.values()), [studentStatuses])
    const gradedResults = useMemo(
        () => examState === "reviewing" ? getGradedResults() : [],
        [examState, getGradedResults],
    )

    const saveMetrics = useCallback(async () => {
        try {
            for (const r of gradedResults) {
                const st = studentStatuses.get(r.studentId)
                await fetch("/api/metrics/exam", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        meetingId: window.location.pathname.split('/').pop(),
                        studentId: r.studentId,
                        studentName: st?.displayName || r.studentId,
                        score: r.score,
                        plagiarismRisk: st?.plagiarismRisk || 0,
                        violations: st?.violations || []
                    })
                })
            }
            alert("Exam metrics permanently saved to cloud database!")
        } catch (e) {
            console.error("Failed to save metrics", e)
        }
    }, [gradedResults, studentStatuses])

    const downloadPDF = useCallback(() => {
        const columns = ["Student", "Score", "Total", "%", "Plagiarism Risk", "Violations"]
        const rows = gradedResults.map(r => {
            const st = studentStatuses.get(r.studentId)
            return [
                st?.displayName ?? r.studentId,
                `${r.score}`,
                `${r.total}`,
                `${r.percentage}%`,
                st?.plagiarismRisk !== undefined ? `${st.plagiarismRisk}%` : "N/A",
                `${st?.violations.length ?? 0}`
            ]
        })
        exportToPDF("Academic Integrity Report", columns, rows, `exam-results-${Date.now()}`)
    }, [gradedResults, studentStatuses])

    const downloadExcel = useCallback(() => {
        const flatData = gradedResults.map(r => {
            const st = studentStatuses.get(r.studentId)
            return {
                "Student Name": st?.displayName ?? r.studentId,
                "Score": r.score,
                "Total Marks": r.total,
                "Percentage (%)": r.percentage,
                "Plagiarism Risk (%)": st?.plagiarismRisk !== undefined ? st.plagiarismRisk : "N/A",
                "Violations Count": st?.violations.length ?? 0
            }
        })
        exportToExcel("Exam Grading Sheet", flatData, `exam-results-${Date.now()}`)
    }, [gradedResults, studentStatuses])

    return (
        <div style={{
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            background: C.bg,
            minHeight: "100%",
            color: C.text,
            display: "flex",
            flexDirection: "column",
            gap: "0",
        }}>
            {/* ─── CONTROL BAR ───────────────────────────────────────── */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 24px",
                background: `linear-gradient(135deg, ${C.surface}, ${C.surfaceHi})`,
                borderBottom: `1px solid ${C.border}`,
                flexWrap: "wrap",
            }}>
                {/* Brand */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "180px" }}>
                    <div style={{
                        width: "36px", height: "36px", borderRadius: "10px",
                        background: `linear-gradient(135deg, ${C.red}, #7f1d1d)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "18px",
                        boxShadow: `0 4px 12px ${C.redGlow}`,
                    }}>🎓</div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "-0.02em" }}>ExamGuard</div>
                        <div style={{ fontSize: "10px", color: C.muted }}>Invigilator Console</div>
                    </div>
                </div>

                {/* State badge */}
                <div style={{
                    padding: "6px 14px", borderRadius: "20px",
                    background: badge.bg,
                    border: `1px solid ${badge.color}40`,
                    color: badge.color,
                    fontWeight: 800, fontSize: "11px",
                    letterSpacing: "0.08em",
                }}>
                    {badge.label}
                </div>

                {/* Timer */}
                {examState === "active" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                            fontSize: "28px",
                            fontWeight: 800,
                            color: timerColor,
                            letterSpacing: "0.05em",
                            textShadow: isLowTime ? `0 0 20px ${C.redHi}` : `0 0 20px ${C.amber}`,
                            transition: "all 0.3s ease",
                        }}>
                            {fmtTime(examTimeRemaining)}
                        </div>
                        {isLowTime && (
                            <div style={{
                                fontSize: "10px", color: C.redHi,
                                fontWeight: 700, animation: "pulse 1s infinite",
                            }}>⚠️ LOW</div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                    {examState === "waiting" && (
                        <Btn onClick={() => {}} color={C.dim} style={{ pointerEvents: "none", opacity: 0.5 }}>
                            Build exam below ↓
                        </Btn>
                    )}
                    {examState === "active" && (
                        <Btn onClick={endExam} color={C.red}>
                            🛑 End Exam
                        </Btn>
                    )}
                    {examState === "reviewing" && (
                        <div style={{ display: "flex", gap: "8px" }}>
                            <Btn onClick={saveMetrics} color={C.blue}>
                                💾 Save to DB
                            </Btn>
                            <Btn onClick={downloadPDF} color={C.green}>
                                📄 PDF Report
                            </Btn>
                            <Btn onClick={downloadExcel} color={C.green}>
                                📊 Excel Sheet
                            </Btn>
                        </div>
                    )}
                </div>

                {/* Quick stats */}
                {examState === "active" && (
                    <div style={{ display: "flex", gap: "16px", marginLeft: "auto" }}>
                        <StatPill label="Students" value={students.length} />
                        <StatPill
                            label="Violations"
                            value={violations.length}
                            color={violations.length > 0 ? C.redHi : C.greenHi}
                        />
                        <StatPill
                            label="Submitted"
                            value={students.filter(s => s.state === "submitted").length}
                            color={C.violetHi}
                        />
                    </div>
                )}
            </div>

            {/* ─── BODY ────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

                {/* ─── WAITING: Question Setup ─── */}
                {examState === "waiting" && (
                    <QuestionBuilder onStart={startExam} />
                )}

                {/* ─── ACTIVE: Exam Hall + Violation Feed ─── */}
                {examState === "active" && (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 320px",
                        gap: "24px",
                        height: "100%",
                    }}>
                        {/* Left: Student Hall */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: C.muted, letterSpacing: "0.1em" }}>
                                EXAM HALL — {students.length} STUDENT{students.length !== 1 ? "S" : ""}
                            </div>
                            {students.length === 0 ? (
                                <GlassCard style={{ textAlign: "center", padding: "40px" }}>
                                    <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
                                    <div style={{ color: C.muted, fontSize: "14px" }}>Waiting for students to join...</div>
                                </GlassCard>
                            ) : (
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                                    gap: "12px",
                                }}>
                                    {students.map(s => (
                                        <StudentCard
                                            key={s.userId}
                                            status={s}
                                            onClick={() => setSelectedStudent(s)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Violation Feed */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: C.muted, letterSpacing: "0.1em" }}>
                                LIVE FEED — {violations.length} EVENT{violations.length !== 1 ? "S" : ""}
                            </div>
                            <div style={{
                                flex: 1,
                                overflowY: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                maxHeight: "calc(100vh - 200px)",
                                paddingRight: "4px",
                            }}>
                                {violations.length === 0 ? (
                                    <GlassCard style={{ textAlign: "center", padding: "24px" }}>
                                        <div style={{ color: C.greenHi, fontSize: "20px", marginBottom: "8px" }}>✅</div>
                                        <div style={{ color: C.muted, fontSize: "12px" }}>No violations detected</div>
                                    </GlassCard>
                                ) : (
                                    violations.map((v, idx) => (
                                        <ViolationFeedItem key={idx} violation={v} />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── REVIEWING: Results Table ─── */}
                {examState === "reviewing" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "20px", fontWeight: 800, color: C.text }}>📊 Exam Results</div>
                                <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
                                    {gradedResults.length} student{gradedResults.length !== 1 ? "s" : ""} graded
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <Btn onClick={downloadPDF} color={C.green}>
                                    📄 Export PDF
                                </Btn>
                                <Btn onClick={downloadExcel} color={C.green}>
                                    📊 Export Excel
                                </Btn>
                            </div>
                        </div>

                        <GlassCard style={{ padding: "0", overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{
                                        background: "rgba(255,255,255,0.04)",
                                        borderBottom: `1px solid ${C.border}`,
                                    }}>
                                        {["Rank", "Student", "Score", "%", "Plagiarism Risk", "Violations", "Status"].map(h => (
                                            <th key={h} style={{
                                                padding: "14px 16px",
                                                textAlign: "left",
                                                fontSize: "10px",
                                                fontWeight: 700,
                                                color: C.dim,
                                                letterSpacing: "0.1em",
                                                textTransform: "uppercase",
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {gradedResults.map((r, i) => {
                                        const st = studentStatuses.get(r.studentId)
                                        const pRisk = st?.plagiarismRisk ?? 0
                                        const pColor = pRisk > 50 ? C.redHi : pRisk > 25 ? C.amber : C.greenHi
                                        const sColor = scoreColor(r.percentage)
                                        return (
                                            <tr
                                                key={r.studentId}
                                                style={{
                                                    borderBottom: `1px solid ${C.border}`,
                                                    transition: "background 0.15s",
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                            >
                                                <td style={{ padding: "14px 16px" }}>
                                                    <RankBadge rank={i + 1} />
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <div style={{ fontWeight: 600, color: C.text, fontSize: "13px" }}>
                                                        {st?.displayName ?? r.studentId}
                                                    </div>
                                                    {st?.submittedAt && (
                                                        <div style={{ fontSize: "10px", color: C.dim, marginTop: "2px" }}>
                                                            Submitted {new Date(st.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <span style={{ fontWeight: 700, color: C.text, fontFamily: "monospace", fontSize: "14px" }}>
                                                        {r.score}
                                                    </span>
                                                    <span style={{ color: C.dim, fontSize: "11px" }}>/{r.total}</span>
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <div style={{
                                                        display: "inline-flex",
                                                        alignItems: "center", gap: "6px",
                                                    }}>
                                                        <div style={{
                                                            width: "40px", height: "4px",
                                                            borderRadius: "2px",
                                                            background: "rgba(255,255,255,0.1)",
                                                            overflow: "hidden",
                                                        }}>
                                                            <div style={{
                                                                height: "100%",
                                                                width: `${r.percentage}%`,
                                                                background: sColor,
                                                                borderRadius: "2px",
                                                            }} />
                                                        </div>
                                                        <span style={{ fontWeight: 700, color: sColor, fontSize: "13px" }}>
                                                            {r.percentage}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        color: pColor,
                                                        fontSize: "13px",
                                                    }}>
                                                        {pRisk}%
                                                    </span>
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <span style={{
                                                        color: (st?.violations.length ?? 0) > 0 ? C.redHi : C.dim,
                                                        fontWeight: 700, fontSize: "13px",
                                                    }}>
                                                        {st?.violations.length ?? 0}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <StatusChip
                                                        label={st?.state === "submitted" ? "Submitted" : "Not Submitted"}
                                                        color={st?.state === "submitted" ? C.greenHi : C.redHi}
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {gradedResults.length === 0 && (
                                <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>
                                    No results yet.
                                </div>
                            )}
                        </GlassCard>
                    </div>
                )}
            </div>

            {/* ─── MODAL ─── */}
            {selectedStudent && (
                <ViolationModal
                    status={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ label, value, color = C.text }: { label: string; value: number; color?: string }) {
    return (
        <div style={{
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${C.border}`,
            borderRadius: "10px",
            padding: "6px 14px",
            textAlign: "center",
        }}>
            <div style={{ fontWeight: 800, fontSize: "18px", color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: "9px", color: C.dim, letterSpacing: "0.08em", marginTop: "2px" }}>{label}</div>
        </div>
    )
}

function ViolationFeedItem({ violation: v }: { violation: StudentViolation }) {
    return (
        <div style={{
            background: "rgba(220,38,38,0.07)",
            border: `1px solid rgba(220,38,38,0.18)`,
            borderRadius: "10px",
            padding: "10px 12px",
            borderLeft: `3px solid ${C.red}`,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        marginBottom: "3px",
                    }}>
                        <span style={{ fontSize: "13px" }}>{violationIcon(v.type)}</span>
                        <span style={{
                            fontWeight: 700, fontSize: "11px",
                            color: C.redHi,
                        }}>
                            {violationLabel(v.type)}
                        </span>
                    </div>
                    <div style={{ fontSize: "11px", color: C.text, fontWeight: 600, marginBottom: "2px" }}>
                        {v.displayName}
                    </div>
                    <div style={{
                        fontSize: "10px", color: C.muted,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                        {v.description}
                    </div>
                </div>
                <div style={{
                    fontSize: "9px", color: C.dim,
                    flexShrink: 0,
                    marginTop: "2px",
                }}>
                    {new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
            </div>
        </div>
    )
}

function RankBadge({ rank }: { rank: number }) {
    const colors = [
        "linear-gradient(135deg, #FFD700, #B8860B)",
        "linear-gradient(135deg, #C0C0C0, #808080)",
        "linear-gradient(135deg, #CD7F32, #8B4513)",
    ]
    const bg = rank <= 3 ? colors[rank - 1] : C.dim + "50"
    return (
        <div style={{
            width: "26px", height: "26px", borderRadius: "50%",
            background: bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: "11px", color: "white",
        }}>
            {rank}
        </div>
    )
}

function StatusChip({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            display: "inline-block",
            padding: "3px 10px", borderRadius: "20px",
            background: color + "20",
            border: `1px solid ${color}40`,
            color,
            fontSize: "10px", fontWeight: 700,
        }}>
            {label}
        </span>
    )
}
