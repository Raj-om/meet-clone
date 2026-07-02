"use client"

import { useState, useEffect, useRef } from "react"
import type { ClassroomSession, QuizQuestion } from "@/hooks/useClassroomSession"
import { useMeetingTranscription } from "@/hooks/useMeetingTranscription"
import { useMeetingMinutes } from "@/hooks/useMeetingMinutes"
import { exportToPDF, exportToExcel } from "@/utils/reportGenerator"

interface Props {
    isHost: boolean
    userId: string
    displayName: string
    session: ClassroomSession
    launchQuiz: (questions: QuizQuestion[]) => void
    endQuiz: () => void
    addNote: (text: string) => void
    getReportData: () => object
    transcript?: string
}

function AttentionRing({ score, size = 56 }: { score: number; size?: number }) {
    const r = (size - 8) / 2
    const circ = 2 * Math.PI * r
    const filled = (score / 100) * circ
    const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={6} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={r}
                stroke={color} strokeWidth={6} fill="none"
                strokeDasharray={`${filled} ${circ}`}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.6s ease" }}
            />
            <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
                fill={color} fontSize={size < 50 ? "10" : "13"} fontWeight="700">
                {score}%
            </text>
        </svg>
    )
}

export default function ClassroomDashboard({ isHost, userId, displayName, session, launchQuiz, endQuiz, addNote, getReportData, transcript }: Props) {
    const [noteText, setNoteText] = useState("")
    const [showQuizBuilder, setShowQuizBuilder] = useState(false)
    const [quizQuestion, setQuizQuestion] = useState("")
    const [quizOptions, setQuizOptions] = useState(["", "", "", ""])
    const [quizCorrect, setQuizCorrect] = useState(0)
    const [myScore, setMyScore] = useState(72)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [elapsed, setElapsed] = useState("0:00")
    
    // AI Transcription & Summarization
    const { isListening, startListening, stopListening, transcript: liveTranscript, currentUtterance } = useMeetingTranscription()
    const { isGenerating, minutes, error: aiError, generateMinutes } = useMeetingMinutes()
    const minutesRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!session.startedAt) return
        const iv = setInterval(() => {
            const diff = Math.floor((Date.now() - session.startedAt!) / 1000)
            setElapsed(`${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")}`)
        }, 1000)
        return () => clearInterval(iv)
    }, [session.startedAt])

    // Pulse my score for demo
    useEffect(() => {
        const iv = setInterval(() => setMyScore(s => Math.min(100, Math.max(0, s + (Math.random() - 0.4) * 5))), 3000)
        return () => clearInterval(iv)
    }, [])

    const students = Array.from(session.students.values())
    const avgAttention = students.length ? Math.round(students.reduce((a, s) => a + s.attentionScore, 0) / students.length) : 0
    const handsUp = students.filter(s => s.handRaised).length
    const active = students.filter(s => Date.now() - s.lastSeen < 10000).length

    const cardBase: React.CSSProperties = {
        background: "rgba(20, 20, 35, 0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
        padding: "14px",
        marginBottom: "10px",
    }

    const handleLaunchQuiz = () => {
        if (!quizQuestion.trim() || quizOptions.some(o => !o.trim())) return
        launchQuiz([{ id: `q-${Date.now()}`, text: quizQuestion, options: quizOptions, correctAnswer: quizOptions[quizCorrect] }])
        setShowQuizBuilder(false)
        setQuizQuestion("")
        setQuizOptions(["", "", "", ""])
    }

    const saveMetrics = async () => {
        try {
            const data: any = getReportData()
            if (!data || !data.students) return

            for (const student of Object.values(data.students)) {
                const s = student as any
                await fetch("/api/metrics/classroom", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        meetingId: window.location.pathname.split('/').pop(),
                        studentId: s.userId || s.displayName,
                        studentName: s.displayName,
                        engagementScore: s.attentionScore,
                        timePresent: Math.floor((Date.now() - s.joinedAt) / 60000)
                    })
                })
            }
            alert("Classroom metrics permanently saved to cloud database!")
        } catch (e) {
            console.error("Failed to save metrics", e)
        }
    }

    const downloadPDF = () => {
        const data: any = getReportData()
        if (!data || !data.students) return
        
        const columns = ["Name", "Avg Attention", "Avg Gaze", "Hands Raised", "Violations"]
        const rows = Object.values(data.students).map((s: any) => [
            s.displayName,
            `${Math.round(s.attentionScore)}%`,
            `${Math.round(s.gazeScore)}%`,
            s.handRaised ? "Yes" : "No",
            s.violations?.length || 0
        ])
        
        exportToPDF("Classroom Attendance & Engagement Report", columns, rows, `classroom-report-${Date.now()}`)
    }

    const downloadExcel = () => {
        const data: any = getReportData()
        if (!data || !data.students) return
        
        const flatData = Object.values(data.students).map((s: any) => ({
            "Student Name": s.displayName,
            "Attention Score (%)": Math.round(s.attentionScore),
            "Gaze Score (%)": Math.round(s.gazeScore),
            "Hand Raised": s.handRaised ? "Yes" : "No",
            "Violations Count": s.violations?.length || 0,
            "Joined At": new Date(s.joinedAt).toLocaleTimeString(),
        }))
        
        exportToExcel("Classroom Report", flatData, `classroom-report-${Date.now()}`)
    }

    // ── Student View ─────────────────────────────────────────────────────────
    if (!isHost) {
        return (
            <div style={{ padding: "12px", color: "white", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ ...cardBase, borderLeft: "4px solid #7c3aed", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "24px" }}>📚</span>
                    <div>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "#a78bfa" }}>Classroom Mode</div>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>Your attention is being monitored</div>
                    </div>
                </div>

                <div style={{ ...cardBase, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <div style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Your Focus Score</div>
                    <AttentionRing score={Math.round(myScore)} size={80} />
                    <div style={{ fontSize: "11px", color: myScore >= 70 ? "#10b981" : myScore >= 40 ? "#f59e0b" : "#ef4444" }}>
                        {myScore >= 70 ? "🟢 Excellent focus" : myScore >= 40 ? "🟡 Moderate focus" : "🔴 Low attention detected"}
                    </div>
                </div>

                {session.activeQuiz && (
                    <div style={{ ...cardBase, borderColor: "rgba(139,92,246,0.4)" }}>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "#a78bfa", marginBottom: "10px" }}>📊 Quick Quiz</div>
                        <div style={{ fontSize: "13px", color: "white", marginBottom: "12px", lineHeight: "1.4" }}>{session.activeQuiz.text}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {session.activeQuiz.options.map((opt, i) => (
                                <button key={i} onClick={() => setSelectedAnswer(opt)} style={{
                                    background: selectedAnswer === opt ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${selectedAnswer === opt ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
                                    color: "white", padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
                                    textAlign: "left", fontSize: "12px", transition: "all 0.2s",
                                    boxShadow: selectedAnswer === opt ? "0 0 10px rgba(124,58,237,0.3)" : "none"
                                }}>{String.fromCharCode(65 + i)}. {opt}</button>
                            ))}
                        </div>
                        {selectedAnswer && (
                            <div style={{ marginTop: "10px", padding: "8px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", fontSize: "11px", color: "#10b981" }}>
                                ✓ Answer submitted: {selectedAnswer}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // ── Host/Teacher View ─────────────────────────────────────────────────────
    return (
        <div style={{ padding: "12px", color: "white", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ ...cardBase, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🏫</span>
                    <div>
                        <div style={{ fontWeight: "700", fontSize: "13px" }}>Classroom Session</div>
                        <div style={{ fontSize: "10px", color: "#9ca3af" }}>⏱ {elapsed}</div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{
                        background: "rgba(16,185,129,0.15)", color: "#10b981",
                        border: "1px solid rgba(16,185,129,0.3)", borderRadius: "99px",
                        fontSize: "10px", fontWeight: "700", padding: "2px 8px"
                    }}>● LIVE</span>
                </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {[
                    { label: "Avg Attention", value: `${avgAttention}%`, color: avgAttention >= 70 ? "#10b981" : "#f59e0b" },
                    { label: "Active", value: String(active || students.length), color: "#60a5fa" },
                    { label: "Hands ✋", value: String(handsUp), color: "#a78bfa" },
                ].map(stat => (
                    <div key={stat.label} style={{ ...cardBase, textAlign: "center", padding: "8px" }}>
                        <div style={{ fontSize: "16px", fontWeight: "700", color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "1px" }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Student Heatmap */}
            <div style={{ ...cardBase }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#a78bfa", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    👥 Student Attention Heatmap
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    {students.map(student => {
                        const cardColor = student.attentionScore >= 70 ? "rgba(16,185,129,0.08)"
                            : student.attentionScore >= 40 ? "rgba(245,158,11,0.08)"
                                : "rgba(239,68,68,0.08)"
                        const borderColor = student.attentionScore >= 70 ? "rgba(16,185,129,0.25)"
                            : student.attentionScore >= 40 ? "rgba(245,158,11,0.25)"
                                : "rgba(239,68,68,0.25)"
                        return (
                            <div key={student.userId} style={{
                                background: cardColor, border: `1px solid ${borderColor}`,
                                borderRadius: "10px", padding: "8px",
                                display: "flex", alignItems: "center", gap: "8px",
                                transition: "all 0.3s"
                            }}>
                                <AttentionRing score={student.attentionScore} size={40} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: "10px", fontWeight: "700", color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {student.handRaised ? "✋ " : ""}{student.displayName.split(" ")[0]}
                                    </div>
                                    <div style={{ fontSize: "9px", color: "#6b7280" }}>
                                        {student.facePresent ? <span style={{ color: "#10b981" }}>● Face OK</span> : <span style={{ color: "#ef4444" }}>● No Face</span>}
                                    </div>
                                    {student.quizAnswers && Object.keys(student.quizAnswers).length > 0 && (
                                        <div style={{ fontSize: "9px", color: "#a78bfa" }}>✓ Answered</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {students.length === 0 && (
                        <div style={{ gridColumn: "span 2", textAlign: "center", color: "#6b7280", fontSize: "12px", padding: "20px" }}>
                            Waiting for students to join...
                        </div>
                    )}
                </div>
            </div>

            {/* Quiz Panel */}
            <div style={{ ...cardBase }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#a78bfa", textTransform: "uppercase" }}>📊 Quick Quiz</div>
                    {session.activeQuiz
                        ? <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={saveMetrics} style={{
                        background: "rgba(59, 130, 246, 0.2)", border: "1px solid #3b82f6", color: "#60a5fa",
                        padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer"
                    }}>
                        💾 Save to DB
                    </button>
                    <button onClick={endQuiz} style={{
                        background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#f87171",
                        padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer"
                    }}>
                        🛑 End Session
                    </button>
                </div>
                        : <button onClick={() => setShowQuizBuilder(v => !v)} style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "10px", fontWeight: "700" }}>+ New Quiz</button>
                    }
                </div>

                {session.activeQuiz && (
                    <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "8px", padding: "10px" }}>
                        <div style={{ fontSize: "11px", color: "#c4b5fd" }}>🔴 Active: {session.activeQuiz.text}</div>
                        <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "4px" }}>
                            {students.filter(s => Object.keys(s.quizAnswers).length > 0).length}/{students.length} answered
                        </div>
                    </div>
                )}

                {showQuizBuilder && !session.activeQuiz && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                        <textarea value={quizQuestion} onChange={e => setQuizQuestion(e.target.value)}
                            placeholder="Question text..." rows={2}
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white", borderRadius: "8px", padding: "8px", fontSize: "12px", resize: "none", outline: "none" }}
                        />
                        {quizOptions.map((opt, i) => (
                            <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <input type="radio" name="correct" checked={quizCorrect === i} onChange={() => setQuizCorrect(i)} style={{ accentColor: "#7c3aed" }} />
                                <input value={opt} onChange={e => { const n = [...quizOptions]; n[i] = e.target.value; setQuizOptions(n) }}
                                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                    style={{ flex: 1, background: quizCorrect === i ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${quizCorrect === i ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.1)"}`, color: "white", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", outline: "none" }}
                                />
                            </div>
                        ))}
                        <button onClick={handleLaunchQuiz} style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "white", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                            🚀 Launch Quiz
                        </button>
                    </div>
                )}
            </div>

            {/* Notes */}
            <div style={{ ...cardBase }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#a78bfa", marginBottom: "8px", textTransform: "uppercase" }}>📝 Lesson Notes</div>
                <div style={{ display: "flex", gap: "6px" }}>
                    <input value={noteText} onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) { addNote(noteText); setNoteText("") } }}
                        placeholder="Add a timestamped note..."
                        style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", outline: "none" }}
                    />
                    <button onClick={() => { if (noteText.trim()) { addNote(noteText); setNoteText("") } }}
                        style={{ background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa", padding: "7px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>+</button>
                </div>
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" }}>
                    {session.lessonNotes.map((note, i) => (
                        <div key={i} style={{ fontSize: "11px", color: "#d1d5db", background: "rgba(255,255,255,0.03)", borderRadius: "6px", padding: "5px 8px", borderLeft: "2px solid #7c3aed" }}>
                            {note}
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Meeting Minutes */}
            <div style={{ ...cardBase }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#a78bfa", textTransform: "uppercase" }}>🎙️ AI Transcription</div>
                    <button onClick={isListening ? stopListening : startListening} style={{
                        background: isListening ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                        border: `1px solid ${isListening ? "#ef4444" : "#10b981"}`,
                        color: isListening ? "#fca5a5" : "#6ee7b7",
                        padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "10px", fontWeight: "700"
                    }}>
                        {isListening ? "🛑 Stop Listening" : "▶ Start Captions"}
                    </button>
                </div>
                
                {(liveTranscript || currentUtterance) && (
                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "10px", maxHeight: "100px", overflowY: "auto", fontSize: "11px", color: "#d1d5db", lineHeight: "1.5", fontStyle: "italic", marginBottom: "10px" }}>
                        {liveTranscript} <span style={{ color: "white" }}>{currentUtterance}</span>
                    </div>
                )}

                <button 
                    onClick={() => generateMinutes(liveTranscript)}
                    disabled={!liveTranscript || isGenerating}
                    style={{
                        width: "100%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white",
                        border: "none", borderRadius: "8px", padding: "8px", cursor: (!liveTranscript || isGenerating) ? "not-allowed" : "pointer",
                        fontSize: "12px", fontWeight: "700", opacity: (!liveTranscript || isGenerating) ? 0.6 : 1, transition: "all 0.2s"
                    }}>
                    {isGenerating ? "🧠 DeepSeek is generating minutes..." : "✨ Generate AI Meeting Minutes"}
                </button>

                {aiError && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "8px" }}>{aiError}</div>}
                
                {minutes && (
                    <div ref={minutesRef} style={{ marginTop: "12px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "8px", padding: "12px" }}>
                        <div style={{ fontSize: "13px", color: "white", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                            {minutes}
                        </div>
                    </div>
                )}
            </div>

            {/* Download */}
            <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={downloadPDF} style={{
                    flex: 1, background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(167,139,250,0.1))",
                    border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa",
                    borderRadius: "10px", padding: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "700",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s"
                }}>
                    📄 Export PDF
                </button>
                <button onClick={downloadExcel} style={{
                    flex: 1, background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(74,222,128,0.1))",
                    border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80",
                    borderRadius: "10px", padding: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "700",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s"
                }}>
                    📊 Export Excel
                </button>
            </div>
        </div>
    )
}
