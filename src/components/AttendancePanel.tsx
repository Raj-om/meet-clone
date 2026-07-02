"use client"

import { useState, useEffect, useRef } from "react"
import type { AttendanceRecord, AttendanceSession, LivenessChallenge, AttendanceResult } from "@/hooks/useAttendanceSystem"

// ─────────────────────────────────────────────────────────────────────────────
// Circular Progress Ring (SVG)
// ─────────────────────────────────────────────────────────────────────────────
function CircleRing({ value, size = 48, stroke = 5, color }: { value: number; size?: number; stroke?: number; color: string }) {
    const r = (size - stroke * 2) / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (value / 100) * circ
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.8s ease", strokeLinecap: "round" }}
            />
        </svg>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Attendance Card
// ─────────────────────────────────────────────────────────────────────────────
function StudentCard({
    record, sessionDuration, minimumPercent
}: {
    record: AttendanceRecord; sessionDuration: number; minimumPercent: number
}) {
    const presentPct = sessionDuration > 0
        ? Math.min(100, Math.round((record.presentDurationMs / sessionDuration) * 100))
        : 0

    const statusColor = record.status === "present"
        ? "#22c55e"
        : record.status === "away"
            ? "#f59e0b"
            : record.status === "absent"
                ? "#ef4444"
                : "#6b7280"

    const ringColor = presentPct >= minimumPercent ? "#22c55e" : presentPct >= 50 ? "#f59e0b" : "#ef4444"
    const passing = presentPct >= minimumPercent && record.livenessScore >= 50
    const failing = presentPct < 50

    return (
        <div style={{
            background: failing
                ? "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(127,18,18,0.12))"
                : passing
                    ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,101,48,0.12))"
                    : "rgba(255,255,255,0.03)",
            border: `1px solid ${failing ? "rgba(239,68,68,0.25)" : passing ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 14, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
            transition: "all 0.3s ease",
            position: "relative", overflow: "hidden",
        }}>
            {/* Presence ring */}
            <div style={{ position: "relative", flexShrink: 0 }}>
                <CircleRing value={presentPct} size={52} stroke={5} color={ringColor} />
                <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: ringColor
                }}>
                    {presentPct}%
                </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                        fontSize: 13, fontWeight: 700, color: "white",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                        {record.displayName}
                    </span>
                    <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                        background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}40`,
                        flexShrink: 0, textTransform: "uppercase"
                    }}>
                        {record.status}
                    </span>
                </div>

                {/* Metrics row */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <MetricBit label="Liveness" value={`${record.livenessScore}%`}
                        color={record.livenessScore >= 50 ? "#22c55e" : "#f59e0b"} />
                    <MetricBit label="Verified" value={`${record.verificationCount}×`} color="#60a5fa" />
                    {record.verificationFailures > 0 && (
                        <MetricBit label="Fail" value={`${record.verificationFailures}×`} color="#ef4444" />
                    )}
                    <MetricBit label="Away" value={`${record.absencePeriods.length}×`} color="#9ca3af" />
                </div>
            </div>

            {/* Pass/Fail badge */}
            <div style={{
                flexShrink: 0, fontSize: 12, fontWeight: 800, padding: "4px 10px",
                borderRadius: 8, textTransform: "uppercase",
                background: passing ? "rgba(34,197,94,0.15)" : failing ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                color: passing ? "#4ade80" : failing ? "#f87171" : "#fbbf24",
                border: `1px solid ${passing ? "#22c55e40" : failing ? "#ef444440" : "#f59e0b40"}`,
            }}>
                {passing ? "✓ PASS" : failing ? "✗ FAIL" : "~ PARTIAL"}
            </div>
        </div>
    )
}

function MetricBit({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Liveness Challenge Overlay
// ─────────────────────────────────────────────────────────────────────────────
function LivenessModal({ challenge, verified, onRetry }: {
    challenge: LivenessChallenge; verified: boolean; onRetry: () => void
}) {
    const [timeLeft, setTimeLeft] = useState(0)
    useEffect(() => {
        const tick = setInterval(() => {
            const left = Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1000))
            setTimeLeft(left)
        }, 200)
        return () => clearInterval(tick)
    }, [challenge.expiresAt])

    const instructions: Record<string, string> = {
        blink: "👁️ Blink your eyes naturally 3 times",
        turn_left: "← Turn your head slightly to the LEFT",
        turn_right: "→ Turn your head slightly to the RIGHT",
        nod: "↕️ Nod your head up and down once",
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            backdropFilter: "blur(8px)"
        }}>
            <div style={{
                background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
                border: verified ? "2px solid #22c55e" : timeLeft < 3 ? "2px solid #ef4444" : "2px solid #7c3aed",
                borderRadius: 24, padding: "40px 48px", textAlign: "center",
                maxWidth: 440, width: "90%",
                boxShadow: `0 0 60px ${verified ? "rgba(34,197,94,0.3)" : "rgba(124,58,237,0.4)"}`,
            }}>
                {verified ? (
                    <>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                        <h2 style={{ color: "#4ade80", fontSize: 22, margin: 0 }}>Liveness Verified!</h2>
                        <p style={{ color: "#9ca3af", marginTop: 8 }}>You are confirmed as a live human</p>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 20, color: "#a78bfa", marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
                            🔐 LIVENESS CHECK
                        </div>
                        <div style={{ fontSize: 48, margin: "16px 0" }}>🎭</div>
                        <p style={{ fontSize: 16, color: "white", fontWeight: 600, marginBottom: 8 }}>
                            {instructions[challenge.type]}
                        </p>
                        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
                            Prove you are a real person, not a photo or video substitution
                        </p>
                        <div style={{
                            fontSize: 40, fontWeight: 900,
                            color: timeLeft < 4 ? "#ef4444" : "#f59e0b"
                        }}>
                            {timeLeft}s
                        </div>
                        {timeLeft === 0 && (
                            <button onClick={onRetry} style={{
                                marginTop: 20, background: "#7c3aed", border: "none",
                                color: "white", borderRadius: 12, padding: "10px 28px",
                                cursor: "pointer", fontSize: 14, fontWeight: 600
                            }}>
                                Try Again
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Stats Bar
// ─────────────────────────────────────────────────────────────────────────────
function StatBar({ label, value, color, emoji }: { label: string; value: string | number; color: string; emoji: string }) {
    return (
        <div style={{
            flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 12,
            padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center",
        }}>
            <span style={{ fontSize: 22 }}>{emoji}</span>
            <span style={{ fontSize: 20, fontWeight: 900, color }}>{value}</span>
            <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AttendancePanel Component
// ─────────────────────────────────────────────────────────────────────────────

interface AttendancePanelProps {
    isHost: boolean
    userId: string
    displayName: string
    attendance: AttendanceResult
    roomMode: "office" | "classroom" | "interview" | "exam" | null
}

export default function AttendancePanel({
    isHost,
    userId,
    displayName,
    attendance,
    roomMode,
}: AttendancePanelProps) {
    const [threshold, setThreshold] = useState(75)
    const [showLivenessModal, setShowLivenessModal] = useState(false)

    const {
        myRecord, allRecords, session, livenessChallenge, livenessVerified,
        startSession, endSession, triggerLivenessChallenge,
        exportCSV, exportPDF, exportExcel, presentCount, absentCount, classAvgPresence,
    } = attendance

    const sessionDuration = session
        ? (session.endedAt || Date.now()) - session.startedAt
        : 0
    const allRecordsList = Array.from(allRecords.values())
    const passing = allRecordsList.filter(r => {
        const pct = sessionDuration > 0 ? Math.round((r.presentDurationMs / sessionDuration) * 100) : 0
        return pct >= (session?.minimumPresentPercent ?? 75) && r.livenessScore >= 50
    }).length

    // Show liveness challenge automatically when issued
    useEffect(() => {
        if (livenessChallenge && !livenessChallenge.passed) {
            setShowLivenessModal(true)
        }
        if (livenessVerified) {
            setTimeout(() => setShowLivenessModal(false), 2000)
        }
    }, [livenessChallenge, livenessVerified])

    const modeEmoji = { office: "🏢", classroom: "🏫", interview: "🎤", exam: "📝" }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 0" }}>

            {/* Liveness modal */}
            {showLivenessModal && livenessChallenge && (
                <LivenessModal
                    challenge={livenessChallenge}
                    verified={livenessVerified}
                    onRetry={() => { setShowLivenessModal(false); setTimeout(triggerLivenessChallenge, 300) }}
                />
            )}

            {/* ── Header ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ color: "white", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                            🎓 Attendance System
                            {roomMode && (
                                <span style={{
                                    fontSize: 10, padding: "2px 8px", borderRadius: 99,
                                    background: "rgba(124,58,237,0.2)", color: "#a78bfa",
                                    border: "1px solid rgba(167,139,250,0.3)", textTransform: "uppercase"
                                }}>
                                    {modeEmoji[roomMode]} {roomMode}
                                </span>
                            )}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                            {session ? `🔴 LIVE · ${allRecords.size} tracked` : "Session not started"}
                        </div>
                    </div>
                    {session && (
                        <div style={{
                            width: 10, height: 10, borderRadius: "50%", background: "#22c55e",
                            boxShadow: "0 0 10px #22c55e", flexShrink: 0,
                            animation: "pulse 2s infinite"
                        }} />
                    )}
                </div>

                {/* Host controls */}
                {isHost && (
                    <div style={{ display: "flex", gap: 8 }}>
                        {!session ? (
                            <>
                                <select
                                    value={threshold}
                                    onChange={e => setThreshold(Number(e.target.value))}
                                    style={{
                                        background: "#1f2937", border: "1px solid #374151",
                                        color: "white", borderRadius: 8, padding: "6px 10px",
                                        fontSize: 12, flex: 1
                                    }}>
                                    <option value={50}>Min 50% presence</option>
                                    <option value={75}>Min 75% presence</option>
                                    <option value={80}>Min 80% presence</option>
                                    <option value={90}>Min 90% presence</option>
                                    <option value={100}>100% required</option>
                                </select>
                                <button
                                    onClick={() => startSession(threshold)}
                                    style={{
                                        background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                        border: "none", color: "white", borderRadius: 8,
                                        padding: "6px 16px", cursor: "pointer", fontSize: 12,
                                        fontWeight: 700, whiteSpace: "nowrap"
                                    }}>
                                    ▶ Start
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={endSession}
                                    style={{
                                        background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                                        color: "#f87171", borderRadius: 8, padding: "6px 14px",
                                        cursor: "pointer", fontSize: 12, fontWeight: 700
                                    }}>
                                    ⏹ End
                                </button>
                                <button
                                    onClick={exportCSV}
                                    style={{
                                        background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                                        color: "#4ade80", borderRadius: 8, padding: "6px 12px",
                                        cursor: "pointer", fontSize: 11, fontWeight: 600
                                    }}>
                                    📊 CSV
                                </button>
                                <button
                                    onClick={exportPDF}
                                    style={{
                                        background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
                                        color: "#93c5fd", borderRadius: 8, padding: "6px 12px",
                                        cursor: "pointer", fontSize: 11, fontWeight: 600
                                    }}>
                                    📄 PDF
                                </button>
                                <button
                                    onClick={exportExcel}
                                    style={{
                                        background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
                                        color: "#fcd34d", borderRadius: 8, padding: "6px 12px",
                                        cursor: "pointer", fontSize: 11, fontWeight: 600
                                    }}>
                                    📊 Excel
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Student: liveness verify button */}
                {!isHost && (
                    <button
                        onClick={() => { triggerLivenessChallenge(); setShowLivenessModal(true) }}
                        style={{
                            background: livenessVerified
                                ? "rgba(34,197,94,0.15)"
                                : "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(109,40,217,0.3))",
                            border: `1px solid ${livenessVerified ? "rgba(34,197,94,0.4)" : "rgba(124,58,237,0.5)"}`,
                            color: livenessVerified ? "#4ade80" : "#a78bfa",
                            borderRadius: 10, padding: "10px 16px",
                            cursor: "pointer", fontSize: 13, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 8
                        }}>
                        {livenessVerified ? "✅ Liveness Verified" : "🔐 Verify Your Liveness"}
                    </button>
                )}
            </div>

            {/* ── Stats (Host only when session active) ── */}
            {session && (
                <div style={{ display: "flex", gap: 8 }}>
                    <StatBar emoji="✅" label="Present" value={presentCount} color="#4ade80" />
                    <StatBar emoji="❌" label="Absent" value={absentCount} color="#f87171" />
                    <StatBar emoji="🏆" label="Passing" value={passing} color="#a78bfa" />
                    <StatBar emoji="📊" label="Avg %" value={`${classAvgPresence}%`} color="#60a5fa" />
                </div>
            )}

            {/* ── Threshold indicator ── */}
            {session && (
                <div style={{
                    background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: 10, padding: "8px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        🎯 Minimum required: <strong style={{ color: "#a78bfa" }}>{session.minimumPresentPercent}%</strong>
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>+ Liveness verification</span>
                </div>
            )}

            {/* ── My record (student view) ── */}
            {!isHost && myRecord && session && (
                <div style={{
                    background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(67,56,202,0.12))",
                    border: "1px solid rgba(124,58,237,0.3)", borderRadius: 14, padding: 16,
                }}>
                    <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                        📌 Your Attendance Record
                    </div>
                    <StudentCard
                        record={myRecord}
                        sessionDuration={sessionDuration}
                        minimumPercent={session.minimumPresentPercent}
                    />
                </div>
            )}

            {/* ── Divider ── */}
            {session && isHost && allRecordsList.length > 0 && (
                <>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                    <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                        Student Records — {allRecordsList.length} total
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {allRecordsList.map(record => (
                            <StudentCard
                                key={record.userId}
                                record={record}
                                sessionDuration={sessionDuration}
                                minimumPercent={session.minimumPresentPercent}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Empty state */}
            {session && isHost && allRecordsList.length === 0 && (
                <div style={{
                    textAlign: "center", padding: "32px 16px",
                    color: "#4b5563", fontSize: 13,
                }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                    Waiting for participants to join...
                </div>
            )}

            {!session && (
                <div style={{
                    textAlign: "center", padding: "32px 16px", borderRadius: 14,
                    background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
                }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🎓</div>
                    <div style={{ color: "#9ca3af", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                        Attendance session not started
                    </div>
                    <div style={{ color: "#4b5563", fontSize: 12 }}>
                        {isHost ? "Start a session above to begin tracking" : "Waiting for host to start attendance tracking"}
                    </div>
                </div>
            )}

            {/* AI Features Info */}
            <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "12px 16px"
            }}>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    🤖 AI Verification Stack
                </div>
                {[
                    { icon: "👁️", label: "MediaPipe Face Landmark Tracking", status: "active" },
                    { icon: "🧬", label: "128-D Face Embedding Match (Cosine)", status: "active" },
                    { icon: "⚡", label: "Anti-Spoofing Liveness Challenge", status: "active" },
                    { icon: "📍", label: "Device Fingerprint (SHA-256)", status: "active" },
                    { icon: "🌐", label: "Geolocation Verification", status: "active" },
                    { icon: "📊", label: "CSV + JSON Report Export", status: "active" },
                ].map(({ icon, label, status }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>{icon}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af", flex: 1 }}>{label}</span>
                        <span style={{
                            fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                            background: "rgba(34,197,94,0.12)", color: "#4ade80",
                            border: "1px solid rgba(34,197,94,0.25)"
                        }}>
                            {status.toUpperCase()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
