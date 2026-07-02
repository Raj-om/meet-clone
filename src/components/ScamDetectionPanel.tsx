import React, { useState } from "react"
import { SignalScores, ScamSignal, MLInsights } from "@/hooks/useScamDetection"
import { AudioDeepfakeLabel } from "@/hooks/useAudioDeepfakeDetection"
import { DireLabel } from "@/hooks/useDireDetection"
import { SuspiciousLink } from "@/hooks/useLinkDetection"

type FaceExpressionLabel = "Natural Motion" | "Unnatural Expression" | "Puppet-Master Suspected"

interface Props {
    riskScore: number
    scores: SignalScores
    isHighRisk: boolean
    isMediumRisk: boolean
    isEnabled: boolean
    setIsEnabled: (v: boolean) => void
    alertHistory: { timestamp: number; riskScore: number; triggeredSignals: ScamSignal[] }[]
    audioLabel?: AudioDeepfakeLabel
    audioScore?: number
    deepfakeLabel?: string
    deepfakeScore?: number
    puppetLabel?: FaceExpressionLabel
    puppetScore?: number
    direLabel?: DireLabel
    direScore?: number
    direMode?: string
    direServerOnline?: boolean
    detectedKeywords?: string[]
    flaggedLinks?: SuspiciousLink[]
    lastDetectedQR?: string | null
    mlInsights?: MLInsights
    lstmPhase?: string
    lstmBootstrapProgress?: number
    aiOptions: {
        deepfakeVideo: boolean
        deepfakeAudio: boolean
        gazeTracking: boolean
        facialLandmarks: boolean
        voiceStress: boolean
        objectDetection: boolean
        linkScanner: boolean
        keywordSentiment: boolean
        behavioral: boolean
    }
    setAiOptions: React.Dispatch<React.SetStateAction<{
        deepfakeVideo: boolean
        deepfakeAudio: boolean
        gazeTracking: boolean
        facialLandmarks: boolean
        voiceStress: boolean
        objectDetection: boolean
        linkScanner: boolean
        keywordSentiment: boolean
        behavioral: boolean
    }>>
}

const SIGNAL_META: { key: ScamSignal; icon: string; label: string }[] = [
    { key: "deepfake", icon: "🤖", label: "Deepfake" },
    { key: "facial", icon: "🎭", label: "Facial" },
    { key: "voice", icon: "🎙️", label: "Voice" },
    { key: "background", icon: "🖼️", label: "Background" },
    { key: "behavioral", icon: "👁️", label: "Behavioral" },
    { key: "keyword", icon: "🔤", label: "Keywords" },
]

function getRiskColor(score: number): string {
    if (score >= 70) return "#ef4444"
    if (score >= 40) return "#f59e0b"
    return "#22c55e"
}

function getRiskLabel(score: number): string {
    if (score >= 70) return "HIGH RISK"
    if (score >= 40) return "SUSPICIOUS"
    return "SAFE"
}

function CircularGauge({ score }: { score: number }) {
    const radius = 42
    const circ = 2 * Math.PI * radius
    const offset = circ - (score / 100) * circ
    const color = getRiskColor(score)

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r={radius} fill="none" stroke="#2a2d31" strokeWidth="10" />
                <circle
                    cx="55" cy="55" r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                    style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                />
                <text x="55" y="50" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">
                    {score}
                </text>
                <text x="55" y="68" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Inter, sans-serif">
                    RISK SCORE
                </text>
            </svg>
            <span style={{
                fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px",
                color, padding: "3px 10px",
                background: `${color}18`,
                borderRadius: "99px", border: `1px solid ${color}40`
            }}>
                {getRiskLabel(score)}
            </span>
        </div>
    )
}

function SignalBar({ meta, value }: { meta: typeof SIGNAL_META[0]; value: number }) {
    const color = getRiskColor(value)
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#d1d5db", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>{meta.icon}</span> {meta.label}
                </span>
                <span style={{ fontSize: "12px", fontWeight: "600", color }}>{value}</span>
            </div>
            <div style={{ height: "5px", background: "#2a2d31", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${value}%`, background: color,
                    borderRadius: "99px",
                    transition: "width 0.5s ease, background 0.4s ease",
                    boxShadow: value > 50 ? `0 0 6px ${color}80` : "none"
                }} />
            </div>
        </div>
    )
}

function OptionCard({ title, desc, icon, active, onClick }: {
    title: string
    desc: string
    icon: string
    active: boolean
    onClick: () => void
}) {
    return (
        <div
            onClick={onClick}
            className={`ai-option-card ${active ? "active" : ""}`}
        >
            {active && <div className="radar-line" />}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
                <span style={{ fontSize: "16px" }}>{icon}</span>
                <span className={`status-dot ${active ? "active" : ""}`} />
            </div>
            <div style={{ color: active ? "#ffffff" : "#9ca3af", fontSize: "11px", fontWeight: "700", zIndex: 2, transition: "color 0.2s" }}>{title}</div>
            <div style={{ color: active ? "#a78bfa" : "#6b7280", fontSize: "9px", lineHeight: "1.1", zIndex: 2, transition: "color 0.2s" }}>{desc}</div>
        </div>
    )
}

export default function ScamDetectionPanel({
    riskScore, scores, isHighRisk, isMediumRisk, isEnabled, setIsEnabled, alertHistory,
    audioLabel, audioScore, deepfakeLabel, deepfakeScore, puppetLabel, puppetScore,
    direLabel, direScore, direMode, direServerOnline, detectedKeywords, flaggedLinks, lastDetectedQR,
    mlInsights, lstmPhase, lstmBootstrapProgress,
    aiOptions, setAiOptions
}: Props) {
    const borderColor = isHighRisk ? "#ef444460" : isMediumRisk ? "#f59e0b60" : "#ffffff10"
    const [showML, setShowML] = useState(true)

    const hmmColors: Record<string, string> = {
        FOCUSED: "#22c55e", DISTRACTED: "#f59e0b",
        SUSPICIOUS: "#f97316", CHEATING: "#ef4444"
    }

    return (
        <div style={{
            background: "linear-gradient(145deg, #1a1d21, #16181c)",
            border: `1px solid ${borderColor}`,
            borderRadius: "16px", padding: "18px", display: "flex", flexDirection: "column", gap: "16px",
            fontFamily: "Inter, system-ui, sans-serif",
            transition: "border-color 0.4s ease",
            boxShadow: isHighRisk ? "0 0 20px rgba(239,68,68,0.15)" : "none",
        }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🛡️</span>
                    <span style={{ color: "white", fontWeight: "700", fontSize: "14px", letterSpacing: "0.3px" }}>
                        Scam Detector
                    </span>
                </div>
                {/* Toggle */}
                <div
                    onClick={() => setIsEnabled(!isEnabled)}
                    style={{
                        width: "38px", height: "20px", borderRadius: "99px", cursor: "pointer",
                        background: isEnabled ? "#22c55e" : "#374151",
                        position: "relative", transition: "background 0.3s ease",
                    }}
                >
                    <div style={{
                        position: "absolute", top: "3px",
                        left: isEnabled ? "20px" : "3px",
                        width: "14px", height: "14px", borderRadius: "50%",
                        background: "white", transition: "left 0.3s ease",
                    }} />
                </div>
            </div>

            {/* Circular gauge */}
            <div style={{ display: "flex", justifyContent: "center" }}>
                {isEnabled
                    ? <CircularGauge score={riskScore} />
                    : <div style={{ color: "#6b7280", fontSize: "13px", padding: "20px 0" }}>AI Scanning Disabled</div>
                }
            </div>

            {/* AI Active Defense Shields */}
            {isEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ height: "1px", background: "#ffffff0a" }} />
                    <div style={{ fontSize: "11px", color: "#8ab4f8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                        🛡️ Active Defense Shields
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <OptionCard
                            title="Video Deepfake"
                            desc="DIRE & DCT artifacts"
                            icon="🤖"
                            active={aiOptions.deepfakeVideo}
                            onClick={() => setAiOptions(prev => ({ ...prev, deepfakeVideo: !prev.deepfakeVideo }))}
                        />
                        <OptionCard
                            title="Audio Deepfake"
                            desc="Voice clone detection"
                            icon="🎙️"
                            active={aiOptions.deepfakeAudio}
                            onClick={() => setAiOptions(prev => ({ ...prev, deepfakeAudio: !prev.deepfakeAudio }))}
                        />
                        <OptionCard
                            title="Gaze Tracking"
                            desc="Attention monitoring"
                            icon="👁️"
                            active={aiOptions.gazeTracking}
                            onClick={() => setAiOptions(prev => ({ ...prev, gazeTracking: !prev.gazeTracking }))}
                        />
                        <OptionCard
                            title="Facial Landmarks"
                            desc="Expression & motions"
                            icon="🎭"
                            active={aiOptions.facialLandmarks}
                            onClick={() => setAiOptions(prev => ({ ...prev, facialLandmarks: !prev.facialLandmarks }))}
                        />
                        <OptionCard
                            title="Voice Stress"
                            desc="Stress level scanner"
                            icon="📈"
                            active={aiOptions.voiceStress}
                            onClick={() => setAiOptions(prev => ({ ...prev, voiceStress: !prev.voiceStress }))}
                        />
                        <OptionCard
                            title="Object Detection"
                            desc="Suspicious items"
                            icon="🔍"
                            active={aiOptions.objectDetection}
                            onClick={() => setAiOptions(prev => ({ ...prev, objectDetection: !prev.objectDetection }))}
                        />
                        <OptionCard
                            title="Link & QR Scan"
                            desc="Scan malicious URLs"
                            icon="🔗"
                            active={aiOptions.linkScanner}
                            onClick={() => setAiOptions(prev => ({ ...prev, linkScanner: !prev.linkScanner }))}
                        />
                        <OptionCard
                            title="Text Sentiment"
                            desc="Keyword scam checking"
                            icon="🔤"
                            active={aiOptions.keywordSentiment}
                            onClick={() => setAiOptions(prev => ({ ...prev, keywordSentiment: !prev.keywordSentiment }))}
                        />
                        <OptionCard
                            title="Behavioral AI"
                            desc="LSTM behavior anomaly"
                            icon="🔁"
                            active={aiOptions.behavioral}
                            onClick={() => setAiOptions(prev => ({ ...prev, behavioral: !prev.behavioral }))}
                        />
                    </div>
                </div>
            )}

            {/* Signal bars */}
            {isEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ height: "1px", background: "#ffffff0a" }} />
                    {SIGNAL_META.map(m => (
                        <SignalBar key={m.key} meta={m} value={scores[m.key]} />
                    ))}
                </div>
            )}

            {/* 🧠 ML Intelligence Section */}
            {isEnabled && mlInsights && (
                <div style={{ border: "1px solid #7c3aed30", borderRadius: "12px", overflow: "hidden" }}>
                    {/* Collapsible header */}
                    <button
                        onClick={() => setShowML(s => !s)}
                        style={{
                            width: "100%", padding: "9px 12px", background: "#7c3aed12",
                            border: "none", cursor: "pointer", display: "flex",
                            justifyContent: "space-between", alignItems: "center",
                        }}
                    >
                        <span style={{ color: "#c4b5fd", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                            🧠 ML Intelligence Brain
                        </span>
                        <span style={{ color: "#7c3aed", fontSize: "11px" }}>{showML ? "▲" : "▼"}</span>
                    </button>
                    {showML && (
                        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>

                            {/* HMM Behavioral State */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#9ca3af", fontSize: "11px" }}>🔮 HMM Behavior State</span>
                                <span style={{
                                    fontSize: "11px", fontWeight: 700, padding: "2px 8px",
                                    background: `${hmmColors[mlInsights.hmmState] ?? "#6b7280"}20`,
                                    color: hmmColors[mlInsights.hmmState] ?? "#9ca3af",
                                    border: `1px solid ${hmmColors[mlInsights.hmmState] ?? "#6b7280"}40`,
                                    borderRadius: "99px",
                                }}>
                                    {mlInsights.hmmState}
                                </span>
                            </div>

                            {/* Bayesian Confidence */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                                    <span style={{ color: "#9ca3af", fontSize: "11px" }}>⚖️ Bayes Confidence</span>
                                    <span style={{ color: "#a78bfa", fontSize: "11px", fontWeight: 700 }}>
                                        {Math.round(mlInsights.confidence * 100)}%
                                    </span>
                                </div>
                                <div style={{ height: "3px", background: "#2a2d31", borderRadius: "99px" }}>
                                    <div style={{
                                        height: "100%", borderRadius: "99px",
                                        width: `${Math.round(mlInsights.confidence * 100)}%`,
                                        background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
                                        transition: "width 0.5s ease",
                                    }} />
                                </div>
                                <div style={{ fontSize: "10px", color: "#4b5563", marginTop: "2px" }}>
                                    Session prior: {Math.round(mlInsights.sessionPrior * 100)}% · {mlInsights.violationsUsedForLearning} violations learned
                                </div>
                            </div>

                            {/* Isolation Forest Anomaly */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#9ca3af", fontSize: "11px" }}>🌲 Iso Forest Anomaly</span>
                                <span style={{
                                    color: mlInsights.isoForestAnomaly > 60 ? "#ef4444" : mlInsights.isoForestAnomaly > 30 ? "#f59e0b" : "#22c55e",
                                    fontSize: "11px", fontWeight: 700,
                                }}>
                                    {mlInsights.isoForestAnomaly}/100
                                </span>
                            </div>

                            {/* LSTM Status */}
                            {lstmPhase && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ color: "#9ca3af", fontSize: "11px" }}>🔁 LSTM Autoencoder</span>
                                    <span style={{ fontSize: "10px", color: "#6b7280" }}>
                                        {lstmPhase === "BOOTSTRAP"
                                            ? `Training… ${lstmBootstrapProgress ?? 0}%`
                                            : lstmPhase === "TRAINING" ? "⚡ Training model…"
                                            : `Anomaly: ${mlInsights.lstmAnomaly ?? 0}/100`}
                                    </span>
                                </div>
                            )}

                            {/* SGD Learned Weights */}
                            <div>
                                <div style={{ color: "#6b7280", fontSize: "10px", marginBottom: "4px" }}>📈 Learned Signal Weights (SGD)</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                    {Object.entries(mlInsights.learnedWeights)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([signal, weight]) => (
                                            <div key={signal} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                <span style={{ color: "#6b7280", fontSize: "10px", width: "70px", textTransform: "capitalize" }}>{signal}</span>
                                                <div style={{ flex: 1, height: "3px", background: "#1a1d21", borderRadius: "99px" }}>
                                                    <div style={{
                                                        height: "100%", width: `${Math.round(weight * 100)}%`,
                                                        background: "linear-gradient(90deg, #7c3aed80, #a78bfa)",
                                                        borderRadius: "99px", transition: "width 0.6s ease",
                                                    }} />
                                                </div>
                                                <span style={{ color: "#9ca3af", fontSize: "10px", width: "30px", textAlign: "right" }}>
                                                    {Math.round(weight * 100)}%
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 🎙️ Audio Deepfake status card */}
            {isEnabled && audioLabel && (
                <div style={{
                    background: audioLabel === "Voice Clone Suspected" ? "#ef444412"
                        : audioLabel === "Possibly Synthetic" ? "#f59e0b12" : "#22c55e10",
                    border: `1px solid ${audioLabel === "Voice Clone Suspected" ? "#ef444430"
                        : audioLabel === "Possibly Synthetic" ? "#f59e0b30" : "#22c55e30"
                        }`,
                    borderRadius: "10px", padding: "9px 12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>🎤</span>
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: "700", color: "white" }}>Voice Analysis</div>
                            <div style={{
                                fontSize: "10px",
                                color: audioLabel === "Voice Clone Suspected" ? "#fca5a5"
                                    : audioLabel === "Possibly Synthetic" ? "#fcd34d" : "#86efac"
                            }}>{audioLabel}</div>
                        </div>
                    </div>
                    <span style={{
                        fontSize: "12px", fontWeight: "700",
                        color: audioScore && audioScore >= 60 ? "#ef4444" : audioScore && audioScore >= 30 ? "#f59e0b" : "#22c55e"
                    }}>{audioScore ?? 0}%</span>
                </div>
            )}

            {/* 🤖 Video Deepfake status card */}
            {isEnabled && deepfakeLabel && deepfakeLabel !== "Real" && (
                <div style={{
                    background: deepfakeLabel === "Deepfake Detected" ? "#ef444412" : "#f59e0b12",
                    border: `1px solid ${deepfakeLabel === "Deepfake Detected" ? "#ef444430" : "#f59e0b30"}`,
                    borderRadius: "10px", padding: "9px 12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>🤖</span>
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: "700", color: "white" }}>Video Analysis</div>
                            <div style={{ fontSize: "10px", color: deepfakeLabel === "Deepfake Detected" ? "#fca5a5" : "#fcd34d" }}>
                                {deepfakeLabel}
                            </div>
                        </div>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: deepfakeScore && deepfakeScore >= 60 ? "#ef4444" : "#f59e0b" }}>
                        {deepfakeScore ?? 0}%
                    </span>
                </div>
            )}

            {/* 🎭 Puppet-Master / Expression Flow card */}
            {isEnabled && puppetLabel && puppetLabel !== "Natural Motion" && (
                <div style={{
                    background: puppetLabel === "Puppet-Master Suspected" ? "#7c3aed12" : "#f59e0b12",
                    border: `1px solid ${puppetLabel === "Puppet-Master Suspected" ? "#7c3aed40" : "#f59e0b30"}`,
                    borderRadius: "10px", padding: "9px 12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>🎭</span>
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: "700", color: "white" }}>Motion Analysis</div>
                            <div style={{
                                fontSize: "10px",
                                color: puppetLabel === "Puppet-Master Suspected" ? "#c4b5fd" : "#fcd34d"
                            }}>{puppetLabel}</div>
                        </div>
                    </div>
                    <span style={{
                        fontSize: "12px", fontWeight: "700",
                        color: puppetScore && puppetScore >= 60 ? "#7c3aed" : "#f59e0b"
                    }}>{puppetScore ?? 0}%</span>
                </div>
            )}

            {/* 🚨 Suspicious Phrases (Authority / Financial) */}
            {isEnabled && detectedKeywords && detectedKeywords.length > 0 && (
                <div style={{
                    background: "#ef444412", border: "1px solid #ef444430",
                    borderRadius: "10px", padding: "10px 12px",
                    display: "flex", flexDirection: "column", gap: "8px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>🚨</span>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#fca5a5" }}>
                            Suspicious Phrases Detected
                        </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {detectedKeywords.map(kw => (
                            <span key={kw} style={{
                                background: "#ef444420", color: "#fca5a5", border: "1px solid #ef444440",
                                padding: "2px 6px", borderRadius: "12px", fontSize: "10px", fontWeight: "600"
                            }}>
                                &ldquo;{kw}&rdquo;
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* 🔗 Malicious Link Detection card */}
            {isEnabled && flaggedLinks && flaggedLinks.length > 0 && (
                <div style={{
                    background: "#ef444412", border: "1px solid #ef444430",
                    borderRadius: "10px", padding: "10px 12px",
                    display: "flex", flexDirection: "column", gap: "8px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>🔗</span>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#fca5a5" }}>
                            Malicious Links Detected
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {flaggedLinks.map(link => (
                            <div key={link.url} style={{
                                background: "#1f2125", border: "1px solid #374151",
                                padding: "6px 8px", borderRadius: "6px"
                            }}>
                                <div style={{ fontSize: "10px", color: "white", wordBreak: "break-all" }}>
                                    {link.url}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                                    <span style={{
                                        fontSize: "9px", fontWeight: "700",
                                        color: link.threatType === "SUSPICIOUS_HEURISTIC" ? "#fcd34d" : "#ef4444"
                                    }}>
                                        {link.threatType.replace(/_/g, " ")}
                                    </span>
                                    <span style={{ fontSize: "9px", color: "#ef4444", fontWeight: "700" }}>{link.riskScore}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 📱 QR Code Safety card */}
            {isEnabled && lastDetectedQR && (
                <div style={{
                    background: "#f59e0b12", border: "1px solid #f59e0b30",
                    borderRadius: "10px", padding: "10px 12px",
                    display: "flex", flexDirection: "column", gap: "8px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>📱</span>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#fcd34d" }}>
                            QR Code Detected
                        </div>
                    </div>
                    <div style={{ fontSize: "10px", color: "white", wordBreak: "break-all", background: "#1f2125", padding: "6px 8px", borderRadius: "6px", border: "1px solid #374151" }}>
                        {lastDetectedQR}
                    </div>
                    <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "-2px" }}>
                        URL sent to safe browsing scanner
                    </div>
                </div>
            )}

            {/* 🔬 DIRE / AI Video Detection card */}
            {isEnabled && (
                <div style={{
                    background: !direServerOnline ? "#1f212580"
                        : direLabel === "AI Generated" ? "#ef444412"
                            : direLabel === "Suspicious" ? "#f59e0b12" : "#22c55e10",
                    border: `1px solid ${!direServerOnline ? "#ffffff15"
                        : direLabel === "AI Generated" ? "#ef444430"
                            : direLabel === "Suspicious" ? "#f59e0b30" : "#22c55e30"
                        }`,
                    borderRadius: "10px", padding: "9px 12px",
                    display: "flex", flexDirection: "column", gap: "6px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px" }}>🔬</span>
                            <div>
                                <div style={{ fontSize: "11px", fontWeight: "700", color: "white" }}>DIRE Analysis</div>
                                <div style={{
                                    fontSize: "10px",
                                    color: !direServerOnline ? "#6b7280"
                                        : direLabel === "AI Generated" ? "#fca5a5"
                                            : direLabel === "Suspicious" ? "#fcd34d" : "#86efac"
                                }}>
                                    {!direServerOnline ? "Server Offline" : (direLabel ?? "Analyzing...")}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {/* Server status dot */}
                            <div style={{
                                width: "7px", height: "7px", borderRadius: "50%",
                                background: direServerOnline ? "#22c55e" : "#6b7280",
                                boxShadow: direServerOnline ? "0 0 6px #22c55e" : "none"
                            }} />
                            {direServerOnline && (
                                <span style={{
                                    fontSize: "12px", fontWeight: "700",
                                    color: direScore && direScore >= 65 ? "#ef4444"
                                        : direScore && direScore >= 35 ? "#f59e0b" : "#22c55e"
                                }}>{direScore ?? 0}%</span>
                            )}
                        </div>
                    </div>
                    {direServerOnline && direMode && (
                        <div style={{
                            fontSize: "9px", color: "#6b7280",
                            background: "#ffffff08", borderRadius: "4px",
                            padding: "2px 6px", alignSelf: "flex-start"
                        }}>{direMode}</div>
                    )}
                    {!direServerOnline && (
                        <div style={{ fontSize: "9px", color: "#4b5563" }}>
                            Run: <code style={{ color: "#9ca3af" }}>deepfake_server\start.bat</code>
                        </div>
                    )}
                </div>
            )}

            {/* Alert history */}
            {isEnabled && alertHistory.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ height: "1px", background: "#ffffff0a" }} />
                    <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600", letterSpacing: "0.5px" }}>
                        RECENT ALERTS
                    </span>
                    {alertHistory.slice(0, 3).map((a, i) => (
                        <div key={i} style={{
                            background: "#ef444412", border: "1px solid #ef444430",
                            borderRadius: "8px", padding: "7px 10px", fontSize: "11px", color: "#fca5a5"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Score: <strong>{a.riskScore}</strong></span>
                                <span style={{ color: "#6b7280" }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div style={{ color: "#9ca3af", marginTop: "2px" }}>
                                {a.triggeredSignals.join(", ")}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
