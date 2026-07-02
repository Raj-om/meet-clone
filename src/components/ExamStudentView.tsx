"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import type {
    ExamState,
    ExamQuestion,
    ExamAnswers,
    StudentViolation,
} from "@/hooks/useExamSession"

// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    examState: ExamState
    questions: ExamQuestion[]
    answers: ExamAnswers
    examTimeRemaining: number
    setAnswer: (questionId: string, answer: string) => void
    submitExam: () => void
    violations: StudentViolation[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
    bg:          "#1e1e2e",
    surface:     "#27273f",
    surfaceHi:   "#2e2e4a",
    card:        "rgba(255,255,255,0.05)",
    border:      "rgba(255,255,255,0.09)",
    violet:      "#7c3aed",
    violetHi:    "#a78bfa",
    violetGlow:  "rgba(124,58,237,0.35)",
    violetSel:   "rgba(124,58,237,0.18)",
    red:         "#dc2626",
    redHi:       "#ef4444",
    amber:       "#f59e0b",
    amberHi:     "#fbbf24",
    green:       "#16a34a",
    greenHi:     "#22c55e",
    text:        "#f1f5f9",
    muted:       "#94a3b8",
    dim:         "#475569",
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function wordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-question countdown timer
// ─────────────────────────────────────────────────────────────────────────────

function QuestionTimer({ timeLimit }: { timeLimit: number }) {
    const [remaining, setRemaining] = useState(timeLimit)
    const endAtRef = useRef(Date.now() + timeLimit * 1000)

    useEffect(() => {
        endAtRef.current = Date.now() + timeLimit * 1000
        setRemaining(timeLimit)
        const interval = setInterval(() => {
            const left = Math.max(0, Math.floor((endAtRef.current - Date.now()) / 1000))
            setRemaining(left)
            if (left <= 0) clearInterval(interval)
        }, 1000)
        return () => clearInterval(interval)
    }, [timeLimit])

    const isLow = remaining < 30
    const pct = (remaining / timeLimit) * 100

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "4px 10px", borderRadius: "8px",
            background: isLow ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isLow ? C.redHi + "40" : C.border}`,
        }}>
            <div style={{
                width: "32px", height: "3px", borderRadius: "2px",
                background: "rgba(255,255,255,0.1)", overflow: "hidden",
            }}>
                <div style={{
                    height: "100%", borderRadius: "2px",
                    width: `${pct}%`,
                    background: isLow ? C.redHi : C.violet,
                    transition: "width 1s linear, background 0.3s",
                }} />
            </div>
            <span style={{
                fontFamily: "monospace",
                fontSize: "12px",
                fontWeight: 700,
                color: isLow ? C.redHi : C.muted,
            }}>
                {fmtTime(remaining)}
            </span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Violation Toast
// ─────────────────────────────────────────────────────────────────────────────

function ViolationToast({ violation }: { violation: StudentViolation | null }) {
    const [visible, setVisible] = useState(false)
    const [shown, setShown] = useState<StudentViolation | null>(null)

    useEffect(() => {
        if (!violation) return
        setShown(violation)
        setVisible(true)
        const t = setTimeout(() => setVisible(false), 4000)
        return () => clearTimeout(t)
    }, [violation])

    if (!shown || !visible) return null

    return (
        <div style={{
            position: "fixed",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "rgba(220,38,38,0.95)",
            backdropFilter: "blur(12px)",
            border: `1px solid rgba(255,255,255,0.2)`,
            borderRadius: "12px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 8px 32px rgba(220,38,38,0.5), 0 2px 8px rgba(0,0,0,0.4)",
            animation: "slideDown 0.3s ease",
            maxWidth: "480px",
            width: "calc(100vw - 40px)",
        }}>
            <div style={{ fontSize: "20px" }}>⚠️</div>
            <div>
                <div style={{ color: "white", fontWeight: 800, fontSize: "13px" }}>
                    Warning: {shown.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px", marginTop: "2px" }}>
                    {shown.description}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MCQ Option Button
// ─────────────────────────────────────────────────────────────────────────────

function MCQOption({
    label, text, selected, onClick,
}: {
    label: string; text: string; selected: boolean; onClick: () => void
}) {
    const [hovered, setHovered] = useState(false)

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                width: "100%",
                padding: "14px 18px",
                borderRadius: "12px",
                border: selected
                    ? `2px solid ${C.violet}`
                    : hovered
                        ? `2px solid ${C.violet}60`
                        : `2px solid ${C.border}`,
                background: selected
                    ? C.violetSel
                    : hovered
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.03)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.18s ease",
                fontFamily: "inherit",
                boxShadow: selected ? `0 0 0 1px ${C.violet}40, 0 4px 20px ${C.violetGlow}` : "none",
                transform: selected ? "scale(1.005)" : "scale(1)",
            }}
        >
            {/* Option label circle */}
            <div style={{
                minWidth: "32px",
                height: "32px",
                borderRadius: "50%",
                background: selected
                    ? `linear-gradient(135deg, ${C.violet}, #5b21b6)`
                    : "rgba(255,255,255,0.08)",
                border: `2px solid ${selected ? C.violet : C.dim}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "12px",
                color: selected ? "white" : C.muted,
                transition: "all 0.18s ease",
                flexShrink: 0,
            }}>
                {label}
            </div>
            <span style={{
                fontSize: "14px",
                color: selected ? C.text : C.muted,
                fontWeight: selected ? 600 : 400,
                lineHeight: 1.5,
                transition: "all 0.18s ease",
            }}>
                {text}
            </span>
            {selected && (
                <div style={{
                    marginLeft: "auto",
                    width: "20px", height: "20px",
                    borderRadius: "50%",
                    background: C.violet,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", color: "white",
                    flexShrink: 0,
                }}>✓</div>
            )}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Question navigator circle
// ─────────────────────────────────────────────────────────────────────────────

function NavCircle({
    number, answered, active, onClick,
}: {
    number: number; answered: boolean; active: boolean; onClick: () => void
}) {
    const bg = active
        ? `linear-gradient(135deg, ${C.violet}, #5b21b6)`
        : answered
            ? `linear-gradient(135deg, ${C.green}, #064e3b)`
            : "rgba(255,255,255,0.07)"

    const border = active
        ? C.violet
        : answered
            ? C.greenHi
            : C.dim

    return (
        <button
            onClick={onClick}
            title={`Question ${number}`}
            style={{
                width: "34px", height: "34px",
                borderRadius: "50%",
                background: bg,
                border: `2px solid ${border}`,
                color: (active || answered) ? "white" : C.dim,
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: active ? `0 0 12px ${C.violetGlow}` : "none",
                flexShrink: 0,
            }}
        >
            {answered && !active ? "✓" : number}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────

function SubmitDialog({
    answeredCount, totalCount, onConfirm, onCancel,
}: {
    answeredCount: number; totalCount: number; onConfirm: () => void; onCancel: () => void
}) {
    const skipped = totalCount - answeredCount
    return (
        <div
            onClick={onCancel}
            style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 9999,
                backdropFilter: "blur(6px)",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: "20px",
                    padding: "32px",
                    width: "400px",
                    maxWidth: "94vw",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: "18px" }}>Submit Exam?</div>
                    <div style={{ color: C.muted, fontSize: "13px", marginTop: "6px" }}>
                        This action cannot be undone.
                    </div>
                </div>

                <div style={{
                    display: "flex", gap: "16px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "24px",
                }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: C.greenHi }}>{answeredCount}</div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>Answered</div>
                    </div>
                    <div style={{ width: "1px", background: C.border }} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: skipped > 0 ? C.amber : C.dim }}>
                            {skipped}
                        </div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>Skipped</div>
                    </div>
                    <div style={{ width: "1px", background: C.border }} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: C.text }}>{totalCount}</div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>Total</div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: "12px", borderRadius: "10px",
                            background: "transparent",
                            border: `1px solid ${C.border}`,
                            color: C.muted, cursor: "pointer",
                            fontWeight: 700, fontSize: "13px", fontFamily: "inherit",
                        }}
                    >
                        Continue Exam
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1, padding: "12px", borderRadius: "10px",
                            background: `linear-gradient(135deg, ${C.violet}, #5b21b6)`,
                            border: "none",
                            color: "white", cursor: "pointer",
                            fontWeight: 700, fontSize: "13px", fontFamily: "inherit",
                            boxShadow: `0 4px 16px ${C.violetGlow}`,
                        }}
                    >
                        Submit Now ✓
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Waiting Room
// ─────────────────────────────────────────────────────────────────────────────

const EXAM_RULES = [
    { icon: "💻", text: "Keep this window in fullscreen mode at all times" },
    { icon: "🔕", text: "Do not switch to other tabs or applications" },
    { icon: "👀", text: "Keep your face clearly visible in the camera" },
    { icon: "📵", text: "No mobile phones or other devices allowed" },
    { icon: "👥", text: "Only one person should be in the camera frame" },
    { icon: "✏️", text: "No notes or books should be visible" },
    { icon: "🔇", text: "Remain in a quiet, well-lit environment" },
]

function WaitingRoom() {
    const [ready, setReady] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        let stream: MediaStream | null = null
        navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
            .then(s => {
                stream = s
                if (videoRef.current) {
                    videoRef.current.srcObject = s
                }
            })
            .catch(() => {/* Camera not available — no-op */})
        return () => { stream?.getTracks().forEach(t => t.stop()) }
    }, [])

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: `radial-gradient(ellipse at center, #1e1e3a 0%, ${C.bg} 70%)`,
            padding: "24px",
            fontFamily: "Inter, system-ui, sans-serif",
        }}>
            <div style={{
                width: "100%",
                maxWidth: "760px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
            }}>
                {/* Header card */}
                <div style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: "20px",
                    padding: "32px",
                    textAlign: "center",
                    backdropFilter: "blur(16px)",
                }}>
                    <div style={{ fontSize: "52px", marginBottom: "12px" }}>⏳</div>
                    <h1 style={{
                        margin: 0,
                        color: C.text,
                        fontWeight: 900,
                        fontSize: "22px",
                        letterSpacing: "-0.03em",
                    }}>
                        Exam Will Start Shortly
                    </h1>
                    <p style={{
                        color: C.muted,
                        fontSize: "14px",
                        marginTop: "8px",
                        marginBottom: 0,
                    }}>
                        Please review the rules and ensure your camera is working
                    </p>
                </div>

                {/* Two-column: Rules + Camera */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                }}>
                    {/* Rules */}
                    <div style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: "16px",
                        padding: "20px",
                        backdropFilter: "blur(16px)",
                    }}>
                        <div style={{
                            fontSize: "12px", fontWeight: 700,
                            color: C.dim, letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            marginBottom: "14px",
                        }}>
                            Exam Rules
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {EXAM_RULES.map((rule, i) => (
                                <div key={i} style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "10px",
                                }}>
                                    <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{rule.icon}</span>
                                    <span style={{ fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>{rule.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Camera */}
                    <div style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: "16px",
                        padding: "20px",
                        backdropFilter: "blur(16px)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                    }}>
                        <div style={{
                            fontSize: "12px", fontWeight: 700,
                            color: C.dim, letterSpacing: "0.1em",
                            textTransform: "uppercase",
                        }}>
                            Camera Preview
                        </div>
                        <div style={{
                            borderRadius: "12px",
                            overflow: "hidden",
                            background: "#000",
                            aspectRatio: "4/3",
                            position: "relative",
                            border: `1px solid ${C.border}`,
                        }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <div style={{
                                position: "absolute",
                                top: "8px", left: "8px",
                                background: "rgba(22,163,74,0.85)",
                                borderRadius: "6px",
                                padding: "3px 8px",
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "white",
                            }}>
                                ● LIVE
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ready checkbox */}
                <div style={{
                    background: C.card,
                    border: `1px solid ${ready ? C.violet + "60" : C.border}`,
                    borderRadius: "14px",
                    padding: "18px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    backdropFilter: "blur(12px)",
                    boxShadow: ready ? `0 0 20px ${C.violetGlow}` : "none",
                }}
                    onClick={() => setReady(r => !r)}
                >
                    <div style={{
                        width: "22px", height: "22px",
                        borderRadius: "6px",
                        border: `2px solid ${ready ? C.violet : C.dim}`,
                        background: ready ? C.violet : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                    }}>
                        {ready && <span style={{ color: "white", fontSize: "13px", fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ color: ready ? C.text : C.muted, fontSize: "14px", fontWeight: 600 }}>
                        I have read the rules and I am ready to begin the exam
                    </span>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Submitted Screen
// ─────────────────────────────────────────────────────────────────────────────

function SubmittedScreen({
    answeredCount, totalCount,
}: { answeredCount: number; totalCount: number }) {
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: `radial-gradient(ellipse at center, #1a2a1a 0%, ${C.bg} 70%)`,
            fontFamily: "Inter, system-ui, sans-serif",
            padding: "24px",
        }}>
            <div style={{
                background: C.card,
                border: `1px solid ${C.greenHi}30`,
                borderRadius: "24px",
                padding: "48px 40px",
                maxWidth: "480px",
                width: "100%",
                textAlign: "center",
                backdropFilter: "blur(20px)",
                boxShadow: `0 0 80px rgba(22,163,74,0.15), 0 24px 60px rgba(0,0,0,0.5)`,
            }}>
                {/* Checkmark */}
                <div style={{
                    width: "80px", height: "80px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.green}, #064e3b)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                    fontSize: "36px",
                    boxShadow: `0 0 40px rgba(22,163,74,0.4)`,
                }}>
                    ✓
                </div>

                <h1 style={{
                    color: C.text,
                    fontWeight: 900,
                    fontSize: "24px",
                    letterSpacing: "-0.03em",
                    margin: "0 0 8px",
                }}>
                    Exam Submitted!
                </h1>
                <p style={{ color: C.muted, fontSize: "14px", margin: "0 0 28px" }}>
                    Your answers have been recorded securely.
                </p>

                {/* Stats */}
                <div style={{
                    display: "flex", gap: "1px",
                    background: C.border,
                    borderRadius: "14px",
                    overflow: "hidden",
                    marginBottom: "28px",
                }}>
                    <div style={{
                        flex: 1, padding: "16px",
                        background: C.surface,
                    }}>
                        <div style={{ fontSize: "28px", fontWeight: 900, color: C.greenHi }}>{answeredCount}</div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>Answered</div>
                    </div>
                    <div style={{
                        flex: 1, padding: "16px",
                        background: C.surface,
                    }}>
                        <div style={{
                            fontSize: "28px", fontWeight: 900,
                            color: (totalCount - answeredCount) > 0 ? C.amber : C.dim,
                        }}>
                            {totalCount - answeredCount}
                        </div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>Skipped</div>
                    </div>
                    <div style={{
                        flex: 1, padding: "16px",
                        background: C.surface,
                    }}>
                        <div style={{ fontSize: "28px", fontWeight: 900, color: C.text }}>{totalCount}</div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>Total</div>
                    </div>
                </div>

                <div style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "12px",
                    padding: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                }}>
                    <div style={{
                        width: "8px", height: "8px",
                        borderRadius: "50%",
                        background: C.amber,
                        animation: "pulse 1.5s infinite",
                        flexShrink: 0,
                    }} />
                    <span style={{ color: C.muted, fontSize: "13px" }}>
                        Waiting for results from your invigilator...
                    </span>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Active Exam Canvas
// ─────────────────────────────────────────────────────────────────────────────

function ActiveExam({
    questions, answers, examTimeRemaining, setAnswer, submitExam, violations,
}: {
    questions: ExamQuestion[]
    answers: ExamAnswers
    examTimeRemaining: number
    setAnswer: (qid: string, answer: string) => void
    submitExam: () => void
    violations: StudentViolation[]
}) {
    const [currentIdx, setCurrentIdx] = useState(0)
    const [showSubmit, setShowSubmit] = useState(false)
    const [lastViolation, setLastViolation] = useState<StudentViolation | null>(null)
    const prevViolationCount = useRef(violations.length)

    // Detect new violations -> show toast
    useEffect(() => {
        if (violations.length > prevViolationCount.current) {
            setLastViolation(violations[0])
        }
        prevViolationCount.current = violations.length
    }, [violations])

    const currentQ = questions[currentIdx]
    const answeredCount = Object.keys(answers).length
    const isLowTime = examTimeRemaining < 300
    const timerColor = isLowTime ? C.redHi : C.amberHi

    if (!currentQ) return null

    return (
        <div style={{
            fontFamily: "Inter, system-ui, sans-serif",
            background: C.bg,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            color: C.text,
        }}>
            {/* Violation Toast */}
            <ViolationToast violation={lastViolation} />

            {/* Submit dialog */}
            {showSubmit && (
                <SubmitDialog
                    answeredCount={answeredCount}
                    totalCount={questions.length}
                    onConfirm={() => { setShowSubmit(false); submitExam() }}
                    onCancel={() => setShowSubmit(false)}
                />
            )}

            {/* ─── TOP BAR ─── */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "12px 24px",
                background: `linear-gradient(135deg, ${C.surface}, ${C.surfaceHi})`,
                borderBottom: `1px solid ${C.border}`,
                flexWrap: "wrap",
            }}>
                {/* Brand */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                    <div style={{
                        width: "30px", height: "30px", borderRadius: "8px",
                        background: `linear-gradient(135deg, ${C.violet}, #5b21b6)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "14px",
                    }}>🎓</div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: "13px" }}>ExamGuard</div>
                        <div style={{ fontSize: "9px", color: C.muted }}>Secure Exam</div>
                    </div>
                </div>

                {/* Progress */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "10px",
                    padding: "6px 14px",
                }}>
                    <span style={{ fontSize: "11px", color: C.muted }}>Progress</span>
                    <div style={{
                        width: "80px", height: "4px",
                        borderRadius: "2px",
                        background: "rgba(255,255,255,0.1)",
                        overflow: "hidden",
                    }}>
                        <div style={{
                            height: "100%",
                            width: `${(answeredCount / questions.length) * 100}%`,
                            background: `linear-gradient(90deg, ${C.violet}, ${C.greenHi})`,
                            borderRadius: "2px",
                            transition: "width 0.4s ease",
                        }} />
                    </div>
                    <span style={{ fontSize: "11px", color: C.text, fontWeight: 700 }}>
                        {answeredCount}/{questions.length}
                    </span>
                </div>

                {/* Timer */}
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "6px 14px",
                    background: isLowTime ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${isLowTime ? C.redHi + "40" : C.border}`,
                    borderRadius: "10px",
                    transition: "all 0.3s ease",
                }}>
                    <span style={{ fontSize: "10px", color: C.muted }}>TIME</span>
                    <span style={{
                        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                        fontSize: "20px",
                        fontWeight: 800,
                        color: timerColor,
                        letterSpacing: "0.05em",
                        textShadow: isLowTime ? `0 0 16px ${C.redHi}` : `0 0 12px ${C.amber}`,
                    }}>
                        {fmtTime(examTimeRemaining)}
                    </span>
                </div>

                {/* Submit */}
                <button
                    onClick={() => setShowSubmit(true)}
                    style={{
                        background: `linear-gradient(135deg, ${C.violet}, #5b21b6)`,
                        border: "none",
                        borderRadius: "10px",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "13px",
                        padding: "8px 20px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: `0 4px 14px ${C.violetGlow}`,
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                    Submit Exam
                </button>
            </div>

            {/* ─── MAIN LAYOUT ─── */}
            <div style={{
                display: "flex",
                flex: 1,
                overflow: "hidden",
                minHeight: "calc(100vh - 56px)",
            }}>
                {/* ─── LEFT SIDEBAR: Question Navigator ─── */}
                <div style={{
                    width: "200px",
                    flexShrink: 0,
                    background: C.surface,
                    borderRight: `1px solid ${C.border}`,
                    padding: "20px 14px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                }}>
                    <div style={{
                        fontSize: "10px", fontWeight: 700,
                        color: C.dim, letterSpacing: "0.1em",
                        textTransform: "uppercase",
                    }}>
                        Questions
                    </div>

                    {/* Legend */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <LegendItem color={C.violet} label="Current" />
                        <LegendItem color={C.greenHi} label="Answered" />
                        <LegendItem color={C.dim} label="Unanswered" />
                    </div>

                    <div style={{
                        height: "1px",
                        background: C.border,
                        margin: "0 -4px",
                    }} />

                    {/* Nav circles - wrap in grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "8px",
                    }}>
                        {questions.map((q, i) => (
                            <NavCircle
                                key={q.id}
                                number={i + 1}
                                answered={!!answers[q.id]}
                                active={i === currentIdx}
                                onClick={() => setCurrentIdx(i)}
                            />
                        ))}
                    </div>

                    {/* Summary */}
                    <div style={{
                        marginTop: "auto",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "10px",
                        padding: "12px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontSize: "10px", color: C.muted }}>Answered</span>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: C.greenHi }}>{answeredCount}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "10px", color: C.muted }}>Remaining</span>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: C.amber }}>
                                {questions.length - answeredCount}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ─── CENTER: Question Canvas ─── */}
                <div style={{
                    flex: 1,
                    padding: "32px 40px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                }}>
                    {/* Question header */}
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                        flexWrap: "wrap",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            {/* Question number badge */}
                            <div style={{
                                width: "40px", height: "40px",
                                borderRadius: "12px",
                                background: `linear-gradient(135deg, ${C.violet}, #5b21b6)`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontWeight: 900,
                                fontSize: "16px",
                                color: "white",
                                flexShrink: 0,
                                boxShadow: `0 4px 16px ${C.violetGlow}`,
                            }}>
                                {currentIdx + 1}
                            </div>
                            <div>
                                <div style={{
                                    fontSize: "10px", fontWeight: 700,
                                    color: C.dim, letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "2px",
                                }}>
                                    Question {currentIdx + 1} of {questions.length}
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span style={{
                                        padding: "2px 8px", borderRadius: "6px",
                                        background: C.violet + "30",
                                        border: `1px solid ${C.violet}50`,
                                        color: C.violetHi,
                                        fontSize: "10px", fontWeight: 700,
                                    }}>
                                        {currentQ.type === "mcq" ? "MCQ" : currentQ.type === "short_answer" ? "Short Answer" : "Essay"}
                                    </span>
                                    <span style={{
                                        fontSize: "11px",
                                        color: C.amber,
                                        fontWeight: 700,
                                    }}>
                                        {currentQ.marks} marks
                                    </span>
                                </div>
                            </div>
                        </div>
                        {currentQ.timeLimit && currentQ.timeLimit > 0 && (
                            <QuestionTimer timeLimit={currentQ.timeLimit} />
                        )}
                    </div>

                    {/* Question text */}
                    <div style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${C.border}`,
                        borderRadius: "16px",
                        padding: "24px 28px",
                    }}>
                        <p style={{
                            color: C.text,
                            fontSize: "17px",
                            lineHeight: 1.65,
                            margin: 0,
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                        }}>
                            {currentQ.text}
                        </p>
                    </div>

                    {/* Answer section */}
                    {currentQ.type === "mcq" && currentQ.options && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {currentQ.options.map((opt, i) => (
                                <MCQOption
                                    key={i}
                                    label={String.fromCharCode(65 + i)}
                                    text={opt}
                                    selected={answers[currentQ.id] === opt}
                                    onClick={() => setAnswer(currentQ.id, opt)}
                                />
                            ))}
                        </div>
                    )}

                    {currentQ.type === "short_answer" && (
                        <div>
                            <textarea
                                value={answers[currentQ.id] ?? ""}
                                onChange={e => setAnswer(currentQ.id, e.target.value)}
                                placeholder="Type your answer here..."
                                rows={6}
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    background: "rgba(255,255,255,0.04)",
                                    border: `2px solid ${answers[currentQ.id] ? C.violet + "60" : C.border}`,
                                    borderRadius: "14px",
                                    color: C.text,
                                    fontSize: "15px",
                                    lineHeight: 1.6,
                                    padding: "16px 20px",
                                    outline: "none",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                    transition: "border-color 0.2s ease",
                                }}
                                onFocus={e => (e.target.style.borderColor = C.violet)}
                                onBlur={e => (e.target.style.borderColor = answers[currentQ.id] ? C.violet + "60" : C.border)}
                            />
                        </div>
                    )}

                    {currentQ.type === "essay" && (
                        <div>
                            <textarea
                                value={answers[currentQ.id] ?? ""}
                                onChange={e => setAnswer(currentQ.id, e.target.value)}
                                placeholder="Write your essay here..."
                                rows={14}
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    background: "rgba(255,255,255,0.04)",
                                    border: `2px solid ${answers[currentQ.id] ? C.violet + "60" : C.border}`,
                                    borderRadius: "14px",
                                    color: C.text,
                                    fontSize: "15px",
                                    lineHeight: 1.7,
                                    padding: "18px 22px",
                                    outline: "none",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                    transition: "border-color 0.2s ease",
                                }}
                                onFocus={e => (e.target.style.borderColor = C.violet)}
                                onBlur={e => (e.target.style.borderColor = answers[currentQ.id] ? C.violet + "60" : C.border)}
                            />
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginTop: "8px",
                                fontSize: "11px",
                                color: C.dim,
                            }}>
                                <span>Write as much detail as you need</span>
                                <span style={{ color: C.muted, fontWeight: 600 }}>
                                    {wordCount(answers[currentQ.id] ?? "")} words
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Prev / Next navigation */}
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "8px",
                        borderTop: `1px solid ${C.border}`,
                    }}>
                        <button
                            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                            disabled={currentIdx === 0}
                            style={{
                                padding: "10px 20px",
                                borderRadius: "10px",
                                border: `1px solid ${C.border}`,
                                background: "transparent",
                                color: currentIdx === 0 ? C.dim : C.muted,
                                cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                                fontWeight: 600,
                                fontSize: "13px",
                                fontFamily: "inherit",
                                opacity: currentIdx === 0 ? 0.4 : 1,
                            }}
                        >
                            ← Previous
                        </button>

                        <div style={{ fontSize: "11px", color: C.dim }}>
                            {currentIdx + 1} / {questions.length}
                        </div>

                        {currentIdx < questions.length - 1 ? (
                            <button
                                onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    border: "none",
                                    background: `linear-gradient(135deg, ${C.violet}, #5b21b6)`,
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    fontFamily: "inherit",
                                    boxShadow: `0 4px 12px ${C.violetGlow}`,
                                }}
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowSubmit(true)}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    border: "none",
                                    background: `linear-gradient(135deg, ${C.green}, #064e3b)`,
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    fontFamily: "inherit",
                                    boxShadow: `0 4px 12px rgba(22,163,74,0.4)`,
                                }}
                            >
                                Finish & Submit ✓
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro helpers
// ─────────────────────────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
                width: "10px", height: "10px", borderRadius: "50%",
                background: color,
            }} />
            <span style={{ fontSize: "10px", color: C.muted }}>{label}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

export default function ExamStudentView({
    examState,
    questions,
    answers,
    examTimeRemaining,
    setAnswer,
    submitExam,
    violations,
}: Props) {
    if (examState === "waiting") {
        return <WaitingRoom />
    }

    if (examState === "active") {
        return (
            <ActiveExam
                questions={questions}
                answers={answers}
                examTimeRemaining={examTimeRemaining}
                setAnswer={setAnswer}
                submitExam={submitExam}
                violations={violations}
            />
        )
    }

    if (examState === "submitted" || examState === "reviewing") {
        return (
            <SubmittedScreen
                answeredCount={Object.keys(answers).length}
                totalCount={questions.length}
            />
        )
    }

    return null
}
