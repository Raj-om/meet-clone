"use client"

/**
 * EngagementPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sidebar panel displaying real-time AI-computed engagement / attention scores.
 *
 * Features:
 *  • Per-user attention score (0–100) with animated gauge
 *  • Live trend indicator (rising / stable / falling)
 *  • Sparkline history chart (60 s window, canvas-drawn)
 *  • Breakdown tooltip showing gaze / face / calm / behaviour sub-scores
 *  • Class-average heatmap bar for the host
 */

import { useEffect, useRef } from "react"
import { EngagementResult } from "@/hooks/useEngagementScore"

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParticipantEngagement {
    userId: string
    displayName: string
    engagement: EngagementResult
    isLocal: boolean
}

interface EngagementPanelProps {
    participants: ParticipantEngagement[]
    isHost: boolean
}

// ── Colours ───────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
    if (score >= 75) return "#22c55e"
    if (score >= 50) return "#eab308"
    if (score >= 25) return "#f97316"
    return "#ef4444"
}

function levelBg(score: number): string {
    if (score >= 75) return "rgba(34,197,94,0.10)"
    if (score >= 50) return "rgba(234,179,8,0.10)"
    if (score >= 25) return "rgba(249,115,22,0.10)"
    return "rgba(239,68,68,0.10)"
}

function trendIcon(trend: EngagementResult["trend"]): string {
    if (trend === "rising")  return "↑"
    if (trend === "falling") return "↓"
    return "→"
}

function trendColor(trend: EngagementResult["trend"]): string {
    if (trend === "rising")  return "#22c55e"
    if (trend === "falling") return "#ef4444"
    return "#9ca3af"
}

// ── Sparkline canvas component ─────────────────────────────────────────────
function Sparkline({ history, color }: { history: { score: number }[]; color: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || history.length < 2) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio
        const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        const w = canvas.offsetWidth
        const h = canvas.offsetHeight

        ctx.clearRect(0, 0, w, h)

        const pts  = history.slice(-60) // up to 60 points
        const minS = 0
        const maxS = 100

        // Gradient fill
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0,   color + "55")
        grad.addColorStop(1,   color + "00")

        ctx.beginPath()
        pts.forEach((p, i) => {
            const x = (i / (pts.length - 1)) * w
            const y = h - ((p.score - minS) / (maxS - minS)) * h
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        const lastX = w
        const lastY = h - ((pts[pts.length - 1].score - minS) / (maxS - minS)) * h
        ctx.lineTo(lastX, h)
        ctx.lineTo(0, h)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()

        // Line
        ctx.beginPath()
        pts.forEach((p, i) => {
            const x = (i / (pts.length - 1)) * w
            const y = h - ((p.score - minS) / (maxS - minS)) * h
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.strokeStyle = color
        ctx.lineWidth   = 1.5
        ctx.lineJoin    = "round"
        ctx.stroke()
    }, [history, color])

    return (
        <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "32px", display: "block", borderRadius: "4px" }}
        />
    )
}

// ── Circular gauge ────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
    const size   = 52
    const stroke = 5
    const r      = (size - stroke) / 2
    const circ   = 2 * Math.PI * r
    const offset = circ * (1 - score / 100)
    const color  = scoreColor(score)

    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={stroke}
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
            />
            <text
                x={size / 2} y={size / 2}
                dominantBaseline="middle" textAnchor="middle"
                fill={color}
                fontSize="13" fontWeight="700"
                style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
            >{score}</text>
        </svg>
    )
}

// ── Breakdown bar ─────────────────────────────────────────────────────────────
function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{ marginBottom: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ color: "#9ca3af", fontSize: "10px" }}>{label}</span>
                <span style={{ color, fontSize: "10px", fontWeight: 600 }}>{value}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "99px", height: "4px", overflow: "hidden" }}>
                <div style={{
                    height: "100%", borderRadius: "99px",
                    width: `${value}%`, background: color,
                    transition: "width 0.5s ease",
                }} />
            </div>
        </div>
    )
}

// ── Participant card ───────────────────────────────────────────────────────────
function ParticipantCard({ p }: { p: ParticipantEngagement }) {
    const { engagement, displayName, isLocal } = p
    const { score, level, trend, history, breakdown } = engagement
    const color = scoreColor(score)

    return (
        <div style={{
            background: levelBg(score),
            border: `1px solid ${color}30`,
            borderRadius: "12px",
            padding: "12px",
            transition: "border-color 0.4s ease",
        }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <ScoreGauge score={score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                            color: "white", fontWeight: 700, fontSize: "13px",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {displayName}{isLocal ? " (You)" : ""}
                        </span>
                        <span style={{ color: trendColor(trend), fontSize: "14px", fontWeight: 700 }}>
                            {trendIcon(trend)}
                        </span>
                    </div>
                    <span style={{
                        display: "inline-block", marginTop: "3px",
                        background: color + "20", border: `1px solid ${color}50`,
                        borderRadius: "99px", padding: "1px 7px",
                        color, fontSize: "10px", fontWeight: 700,
                    }}>{level}</span>
                </div>
            </div>

            {/* Sparkline */}
            {history.length > 2 && (
                <div style={{ marginBottom: "10px" }}>
                    <Sparkline history={history} color={color} />
                </div>
            )}

            {/* Breakdown */}
            <div style={{
                background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px",
            }}>
                <div style={{ color: "#6b7280", fontSize: "10px", fontWeight: 600, marginBottom: "6px", letterSpacing: "0.5px" }}>
                    SIGNAL BREAKDOWN
                </div>
                <BreakdownBar label="👁 Gaze"      value={breakdown.gazeScore}     color="#60a5fa" />
                <BreakdownBar label="😊 Face"      value={breakdown.faceScore}     color="#a78bfa" />
                <BreakdownBar label="🎙 Calm"       value={breakdown.calmScore}     color="#34d399" />
                <BreakdownBar label="🧠 Behaviour"  value={breakdown.behaviorScore} color="#f59e0b" />
            </div>
        </div>
    )
}

// ── Class average heatmap ─────────────────────────────────────────────────────
function ClassAverage({ participants }: { participants: ParticipantEngagement[] }) {
    if (participants.length === 0) return null
    const avg = Math.round(
        participants.reduce((s, p) => s + p.engagement.score, 0) / participants.length
    )
    const color = scoreColor(avg)
    const distributed = participants.sort((a, b) => b.engagement.score - a.engagement.score)

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            padding: "12px 14px",
            marginBottom: "12px",
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px" }}>
                    📊 CLASS AVERAGE
                </span>
                <span style={{ color, fontSize: "20px", fontWeight: 800 }}>{avg}</span>
            </div>

            {/* Mini heatmap row */}
            <div style={{ display: "flex", gap: "3px", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                {distributed.map(p => (
                    <div
                        key={p.userId}
                        style={{
                            flex: 1,
                            background: scoreColor(p.engagement.score),
                            opacity: 0.8,
                            transition: "background 0.5s ease",
                        }}
                        title={`${p.displayName}: ${p.engagement.score}`}
                    />
                ))}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                <span style={{ color: "#22c55e", fontSize: "9px" }}>High</span>
                <span style={{ color: "#9ca3af", fontSize: "9px" }}>Engagement Heatmap</span>
                <span style={{ color: "#ef4444", fontSize: "9px" }}>Low</span>
            </div>
        </div>
    )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function EngagementPanel({ participants, isHost }: EngagementPanelProps) {
    const hostVisible = participants.filter(p => p.engagement.score !== undefined)

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%", overflowY: "auto" }}>
            {/* Header */}
            <div style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: "10px",
                padding: "10px 12px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>📈</span>
                    <div>
                        <div style={{ color: "#c4b5fd", fontSize: "12px", fontWeight: 700 }}>
                            Real-Time Engagement AI
                        </div>
                        <div style={{ color: "#6b7280", fontSize: "10px" }}>
                            Gaze · Stress · LSTM · Face — fully on-device
                        </div>
                    </div>
                </div>
            </div>

            {/* Class average (host only) */}
            {isHost && hostVisible.length > 1 && (
                <ClassAverage participants={hostVisible} />
            )}

            {/* Per-participant cards */}
            {participants.length === 0 ? (
                <div style={{ color: "#4b5563", fontSize: "13px", textAlign: "center", marginTop: "24px" }}>
                    No participants yet.<br />
                    <span style={{ fontSize: "11px" }}>AI detection starts when Student Mode is active.</span>
                </div>
            ) : (
                participants.map(p => <ParticipantCard key={p.userId} p={p} />)
            )}

            {/* Research attribution */}
            <div style={{
                marginTop: "auto",
                padding: "8px 10px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "8px",
                color: "#374151",
                fontSize: "10px",
                lineHeight: "1.5",
            }}>
                🔬 Based on 2025/2026 multimodal engagement detection research.
                All inference is local — no data leaves your device.
            </div>
        </div>
    )
}
