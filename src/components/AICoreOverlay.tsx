"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion"

// ── Custom Cursor ─────────────────────────────────────────────────────────────
function CustomCursor() {
    const cursorX = useMotionValue(-100)
    const cursorY = useMotionValue(-100)
    const springX = useSpring(cursorX, { stiffness: 500, damping: 28 })
    const springY = useSpring(cursorY, { stiffness: 500, damping: 28 })
    const trailX = useSpring(cursorX, { stiffness: 120, damping: 22 })
    const trailY = useSpring(cursorY, { stiffness: 120, damping: 22 })
    const [clicked, setClicked] = useState(false)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
        const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY) }
        const down = () => setClicked(true)
        const up = () => setClicked(false)
        window.addEventListener("mousemove", move)
        window.addEventListener("mousedown", down)
        window.addEventListener("mouseup", up)

        // detect hoverable elements
        const hoverEls = document.querySelectorAll("[data-magnetic]")
        hoverEls.forEach(el => {
            el.addEventListener("mouseenter", () => setHovered(true))
            el.addEventListener("mouseleave", () => setHovered(false))
        })
        return () => {
            window.removeEventListener("mousemove", move)
            window.removeEventListener("mousedown", down)
            window.removeEventListener("mouseup", up)
        }
    }, [cursorX, cursorY])

    return (
        <>
            {/* Inner dot */}
            <motion.div style={{
                position: "fixed", left: springX, top: springY, zIndex: 9999,
                width: 8, height: 8, borderRadius: "50%",
                background: "#06b6d4", pointerEvents: "none",
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 12px #06b6d4, 0 0 24px #06b6d4",
                scale: clicked ? 0.5 : 1
            }} />
            {/* Outer ring */}
            <motion.div style={{
                position: "fixed", left: trailX, top: trailY, zIndex: 9998,
                width: hovered ? 48 : 28, height: hovered ? 48 : 28,
                borderRadius: "50%", pointerEvents: "none",
                border: `1.5px solid ${hovered ? "#a78bfa" : "#06b6d433"}`,
                background: hovered ? "rgba(124,58,237,0.1)" : "transparent",
                boxShadow: hovered ? "0 0 20px #7c3aed66" : "none",
                x: "-50%", y: "-50%",
                transition: "width 0.2s, height 0.2s, border-color 0.2s"
            }} />
        </>
    )
}

// ── Floating Glass Card ───────────────────────────────────────────────────────
function GlassCard({ children, className, delay = 0, style = {} }: {
    children: React.ReactNode; className?: string; delay?: number; style?: React.CSSProperties
}) {
    const ref = useRef<HTMLDivElement>(null)
    const rotX = useMotionValue(0)
    const rotY = useMotionValue(0)
    const springRotX = useSpring(rotX, { stiffness: 300, damping: 30 })
    const springRotY = useSpring(rotY, { stiffness: 300, damping: 30 })

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        rotX.set((e.clientY - cy) / rect.height * -12)
        rotY.set((e.clientX - cx) / rect.width * 12)
    }
    const handleMouseLeave = () => { rotX.set(0); rotY.set(0) }

    return (
        <motion.div
            ref={ref}
            data-magnetic="true"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
                rotateX: springRotX,
                rotateY: springRotY,
                transformStyle: "preserve-3d",
                backdropFilter: "blur(20px) saturate(180%)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                boxShadow: "0 0 40px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
                ...style
            }}
        >
            {children}
        </motion.div>
    )
}

// ── Animated Letter Reveal ────────────────────────────────────────────────────
function RevealText({ text, delay = 0, style = {} }: { text: string; delay?: number; style?: React.CSSProperties }) {
    return (
        <motion.span style={{ display: "inline-flex", ...style }}>
            {text.split("").map((char, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: delay + i * 0.04, duration: 0.4, ease: "easeOut" }}
                    style={{ display: "inline-block", whiteSpace: "pre" }}
                >
                    {char}
                </motion.span>
            ))}
        </motion.span>
    )
}

// ── Circular HUD ──────────────────────────────────────────────────────────────
function HUDRing({ value, label, color, size = 80 }: { value: number; label: string; color: string; size?: number }) {
    const r = (size / 2) - 8
    const circ = 2 * Math.PI * r
    const dash = (value / 100) * circ
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 2, delay: 1, ease: "easeOut" }}
                    style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                />
                <text x={size / 2} y={size / 2 + 5} textAnchor="middle"
                    fill="white" fontSize={13} fontWeight="600"
                    style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>
                    {value}%
                </text>
            </svg>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
        </div>
    )
}

// ── Status Widget ─────────────────────────────────────────────────────────────
function StatusDot({ active, label }: { active: boolean; label: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.div
                animate={{ scale: active ? [1, 1.3, 1] : 1, opacity: active ? 1 : 0.3 }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: active ? "#22c55e" : "#6b7280",
                    boxShadow: active ? "0 0 8px #22c55e" : "none"
                }}
            />
            <span style={{ fontSize: 11, color: active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)", letterSpacing: 0.5 }}>
                {label}
            </span>
        </div>
    )
}

// ── Aurora Background ─────────────────────────────────────────────────────────
function AuroraBackground({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {/* Aurora gradient 1 */}
            <motion.div animate={{
                x: mouseX * 0.03, y: mouseY * 0.03,
                background: [
                    "radial-gradient(ellipse 800px 500px at 20% 30%, rgba(124,58,237,0.15) 0%, transparent 70%)",
                    "radial-gradient(ellipse 800px 500px at 25% 35%, rgba(124,58,237,0.2) 0%, transparent 70%)",
                ]
            }} transition={{ duration: 0.1 }} style={{
                position: "absolute", inset: 0,
            }} />
            {/* Aurora gradient 2 */}
            <motion.div animate={{
                x: -mouseX * 0.02, y: -mouseY * 0.02,
            }} transition={{ duration: 0.15 }} style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 600px 400px at 80% 70%, rgba(6,182,212,0.12) 0%, transparent 70%)",
            }} />
            {/* Aurora gradient 3 – magenta */}
            <motion.div animate={{
                x: mouseX * 0.015, y: -mouseY * 0.015,
            }} transition={{ duration: 0.12 }} style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 500px 300px at 60% 20%, rgba(236,72,153,0.08) 0%, transparent 70%)",
            }} />
            {/* Dynamic spotlight */}
            <motion.div animate={{ x: mouseX * 0.05, y: mouseY * 0.05 }} transition={{ duration: 0.05 }} style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 300px 300px at 50% 50%, rgba(124,58,237,0.05) 0%, transparent 60%)",
            }} />
            {/* Scanline overlay */}
            <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
                pointerEvents: "none"
            }} />
        </div>
    )
}

// ── Main Overlay ──────────────────────────────────────────────────────────────
export default function AICoreOverlay() {
    const [mouse, setMouse] = useState({ x: 0, y: 0 })
    const [time, setTime] = useState("")
    const [tick, setTick] = useState(0)

    useEffect(() => {
        const move = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY })
        window.addEventListener("mousemove", move)
        return () => window.removeEventListener("mousemove", move)
    }, [])

    useEffect(() => {
        const id = setInterval(() => {
            setTime(new Date().toLocaleTimeString("en-US", { hour12: false }))
            setTick(t => t + 1)
        }, 1000)
        return () => clearInterval(id)
    }, [])

    return (
        <>
            <CustomCursor />
            <AuroraBackground mouseX={mouse.x - window.innerWidth / 2} mouseY={mouse.y - window.innerHeight / 2} />

            {/* ── TOP LEFT: System Identity ── */}
            <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: "absolute", top: 32, left: 40, zIndex: 10 }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <motion.div
                        animate={{ boxShadow: ["0 0 12px #7c3aed", "0 0 24px #7c3aed", "0 0 12px #7c3aed"] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }}
                    />
                    <span style={{ fontSize: 10, letterSpacing: 4, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontFamily: "'Inter', monospace" }}>
                        CLARIVOX · AI CORE
                    </span>
                </div>
                <div style={{
                    fontSize: 36, fontWeight: 800, letterSpacing: -1,
                    background: "linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #06b6d4 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontFamily: "'Inter', sans-serif", lineHeight: 1.1
                }}>
                    <RevealText text="CLARIVOX" delay={0.2} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>
                    <RevealText text="Neural Intelligence System v7.4.1" delay={0.6} />
                </div>
            </motion.div>

            {/* ── TOP RIGHT: Clock + Status ── */}
            <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
                style={{ position: "absolute", top: 32, right: 40, zIndex: 10, textAlign: "right" }}
            >
                <div style={{
                    fontSize: 28, fontWeight: 700, fontFamily: "'Inter', monospace",
                    color: "#06b6d4", letterSpacing: 2,
                    textShadow: "0 0 20px rgba(6,182,212,0.5)"
                }}>
                    {time}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 2, marginTop: 2 }}>
                    UTC+5:30 · SYSTEM ONLINE
                </div>
            </motion.div>

            {/* ── CENTER TOP: Main Title ── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.5 }}
                style={{
                    position: "absolute", top: 36, left: "50%", transform: "translateX(-50%)",
                    zIndex: 10, textAlign: "center"
                }}
            >
                <div style={{
                    fontSize: 11, letterSpacing: 6, color: "rgba(255,255,255,0.25)",
                    textTransform: "uppercase", fontFamily: "'Inter', sans-serif"
                }}>
                    QUANTUM NEURAL MATRIX ACTIVE
                </div>
            </motion.div>

            {/* ── LEFT PANEL: System Metrics ── */}
            <GlassCard delay={0.7} style={{
                position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, padding: "24px 20px", width: 190, display: "flex",
                flexDirection: "column", gap: 20
            }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                    AI Metrics
                </div>
                <HUDRing value={94} label="Neural Load" color="#7c3aed" size={72} />
                <HUDRing value={78} label="Threat Shield" color="#06b6d4" size={72} />
                <HUDRing value={61} label="Attention AI" color="#ec4899" size={72} />
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <StatusDot active={true} label="DeepFake Shield" />
                    <StatusDot active={true} label="Voice Analysis" />
                    <StatusDot active={true} label="Gaze Tracking" />
                    <StatusDot active={false} label="Quantum Relay" />
                </div>
            </GlassCard>

            {/* ── RIGHT PANEL: Live Feed ── */}
            <GlassCard delay={0.9} style={{
                position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, padding: "24px 20px", width: 200,
                display: "flex", flexDirection: "column", gap: 14
            }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                    Live Intelligence
                </div>
                {[
                    { label: "Participants", value: "4", color: "#a78bfa" },
                    { label: "Risk Score", value: "LOW · 2", color: "#22c55e" },
                    { label: "Deepfakes", value: "0 detected", color: "#06b6d4" },
                    { label: "Alerts Fired", value: tick % 10 === 0 ? "12" : "12", color: "#f59e0b" },
                    { label: "AI Uptime", value: "99.97%", color: "#ec4899" },
                    { label: "Latency", value: "14ms", color: "#06b6d4" },
                ].map((item, i) => (
                    <motion.div key={item.label}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + i * 0.1 }}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{item.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: item.color, fontFamily: "monospace",
                            textShadow: `0 0 8px ${item.color}66` }}>
                            {item.value}
                        </span>
                    </motion.div>
                ))}
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
                {/* Mini bar graph */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 2 }}>THREAT TIMELINE</div>
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 32 }}>
                        {[20, 45, 30, 80, 25, 60, 15, 70, 40, 55, 20, 35].map((h, i) => (
                            <motion.div key={i}
                                initial={{ height: 0 }}
                                animate={{ height: h * 0.32 }}
                                transition={{ delay: 1.5 + i * 0.05 }}
                                style={{
                                    flex: 1, borderRadius: 2,
                                    background: h > 60 ? "#ef4444" : h > 40 ? "#f59e0b" : "#7c3aed",
                                    opacity: 0.7
                                }}
                            />
                        ))}
                    </div>
                </div>
            </GlassCard>

            {/* ── BOTTOM CENTER: Action Panel ── */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
                    zIndex: 10, display: "flex", gap: 12, alignItems: "center"
                }}
            >
                {[
                    { label: "SCAM AI", icon: "🛡️", color: "#7c3aed", active: true },
                    { label: "NEURAL MAP", icon: "🕸️", color: "#06b6d4", active: true },
                    { label: "INTERVIEW", icon: "🎤", color: "#ec4899", active: false },
                    { label: "EXAM HALL", icon: "📝", color: "#f59e0b", active: false },
                    { label: "CLASSROOM", icon: "🏫", color: "#a78bfa", active: false },
                ].map((btn, i) => (
                    <motion.button
                        key={btn.label}
                        data-magnetic="true"
                        whileHover={{ scale: 1.08, y: -3 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.3 + i * 0.08 }}
                        style={{
                            background: btn.active
                                ? `linear-gradient(135deg, ${btn.color}33, ${btn.color}11)`
                                : "rgba(255,255,255,0.02)",
                            border: `1px solid ${btn.active ? btn.color + "55" : "rgba(255,255,255,0.06)"}`,
                            borderRadius: 12, padding: "10px 18px",
                            color: btn.active ? btn.color : "rgba(255,255,255,0.3)",
                            fontSize: 10, fontWeight: 700, letterSpacing: 2,
                            cursor: "pointer", backdropFilter: "blur(12px)",
                            display: "flex", alignItems: "center", gap: 6,
                            boxShadow: btn.active ? `0 0 20px ${btn.color}22` : "none",
                            transition: "all 0.3s ease",
                            textTransform: "uppercase" as const
                        }}
                    >
                        <span>{btn.icon}</span>
                        <span>{btn.label}</span>
                    </motion.button>
                ))}
            </motion.div>

            {/* ── CENTER LABEL: AI Core Label ── */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
                style={{
                    position: "absolute", top: "calc(50% + 160px)", left: "50%",
                    transform: "translateX(-50%)", zIndex: 10, textAlign: "center"
                }}
            >
                <motion.div
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    style={{
                        fontSize: 10, letterSpacing: 6, color: "#7c3aed",
                        textTransform: "uppercase", fontFamily: "'Inter', sans-serif",
                        textShadow: "0 0 12px #7c3aed"
                    }}
                >
                    ◈ QUANTUM NEURAL CORE ACTIVE ◈
                </motion.div>
            </motion.div>
        </>
    )
}
