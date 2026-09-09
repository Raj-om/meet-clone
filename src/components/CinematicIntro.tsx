"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0 = idle (start button)
// 1 = data threads (0–4s)
// 2 = glass cube with cracking (4–9s)
// 3 = silence / freeze (9–9.5s)
// 4 = shatter + frozen shards (9.5–10.5s)
// 5 = phone reveal (10.5–14s)
// 6 = complete

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  hue: number; trail: { x: number; y: number }[];
  angle: number; frozen: boolean; rotAngle: number;
}

// ─── Audio Engine ─────────────────────────────────────────────────────────────
function buildAudio(ctx: AudioContext) {
  const t = ctx.currentTime;

  // ── Sub-bass pulse ──────────────────────────────────
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(38, t);
  sub.frequency.setValueAtTime(48, t + 3);
  sub.frequency.setValueAtTime(38, t + 6);
  sub.frequency.linearRampToValueAtTime(70, t + 9);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0, t);
  subGain.gain.linearRampToValueAtTime(0.75, t + 0.5);
  subGain.gain.linearRampToValueAtTime(0.95, t + 8.8);
  subGain.gain.linearRampToValueAtTime(0, t + 9.3);
  sub.connect(subGain); subGain.connect(ctx.destination);
  sub.start(t); sub.stop(t + 9.5);

  // ── Ticking tension rhythm ──────────────────────────
  const bpm = 128;
  const beat = 60 / bpm;
  for (let i = 0; i < 36; i++) {
    const tick = ctx.createOscillator();
    const isAccent = i % 4 === 0;
    const tickTime = t + i * beat * 0.5;
    tick.type = "square";
    tick.frequency.value = isAccent ? 1200 : 900;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0, tickTime);
    tg.gain.linearRampToValueAtTime(isAccent ? 0.1 : 0.04, tickTime + 0.008);
    tg.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.06);
    const tf = ctx.createBiquadFilter();
    tf.type = "highpass"; tf.frequency.value = 700;
    tick.connect(tf); tf.connect(tg); tg.connect(ctx.destination);
    tick.start(tickTime); tick.stop(tickTime + 0.1);
  }

  // ── Rising string swell ─────────────────────────────
  const swell = ctx.createOscillator();
  swell.type = "sawtooth";
  swell.frequency.setValueAtTime(220, t + 4.5);
  swell.frequency.linearRampToValueAtTime(880, t + 9);
  const swellFilter = ctx.createBiquadFilter();
  swellFilter.type = "lowpass";
  swellFilter.frequency.setValueAtTime(400, t + 4.5);
  swellFilter.frequency.linearRampToValueAtTime(2200, t + 9);
  const swellGain = ctx.createGain();
  swellGain.gain.setValueAtTime(0, t + 4.5);
  swellGain.gain.linearRampToValueAtTime(0.12, t + 7);
  swellGain.gain.linearRampToValueAtTime(0, t + 9.3);
  swell.connect(swellFilter); swellFilter.connect(swellGain); swellGain.connect(ctx.destination);
  swell.start(t + 4.5); swell.stop(t + 9.5);
}

function explosiveBrass(ctx: AudioContext) {
  const t = ctx.currentTime;

  // ── Taiko drum (noise burst) ────────────────────────
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, rate * 0.6, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < buf.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / buf.length, 2.5);
  }
  const drum = ctx.createBufferSource(); drum.buffer = buf;
  const drumFilter = ctx.createBiquadFilter(); drumFilter.type = "lowpass"; drumFilter.frequency.value = 180;
  const drumGain = ctx.createGain(); drumGain.gain.setValueAtTime(3, t); drumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  drum.connect(drumFilter); drumFilter.connect(drumGain); drumGain.connect(ctx.destination);
  drum.start(t);

  // ── Hans Zimmer brass chord ─────────────────────────
  [65, 98, 130, 196, 261].forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.06); f.frequency.exponentialRampToValueAtTime(400, t + 2.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 - i * 0.03, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    osc.connect(f); f.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 4);
  });

  // ── Rising afterglow ─────────────────────────────────
  const rise = ctx.createOscillator(); rise.type = "triangle";
  rise.frequency.setValueAtTime(130, t + 0.1); rise.frequency.linearRampToValueAtTime(520, t + 3);
  const rg = ctx.createGain(); rg.gain.setValueAtTime(0, t + 0.1);
  rg.gain.linearRampToValueAtTime(0.2, t + 0.4); rg.gain.linearRampToValueAtTime(0, t + 4);
  rise.connect(rg); rg.connect(ctx.destination); rise.start(t + 0.1); rise.stop(t + 4);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>(0);
  const phaseRef = useRef<Phase>(0);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [cubeShaking, setCubeShaking] = useState(false);
  const [crackLevel, setCrackLevel] = useState(0);
  const [showCube, setShowCube] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  // Safety fallback
  useEffect(() => {
    const t = setTimeout(onComplete, 22000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const handleStart = useCallback(() => {
    // Audio
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC(); ctx.resume();
      audioCtxRef.current = ctx;
      buildAudio(ctx);
    } catch (e) { console.warn("Audio unavailable:", e); }

    // Timeline
    go(1);
    setTimeout(() => { go(2); setShowCube(true); }, 4000);
    setTimeout(() => { setCubeShaking(true); setCrackLevel(1); }, 6200);
    setTimeout(() => setCrackLevel(2), 7600);
    setTimeout(() => setCrackLevel(3), 8400);
    setTimeout(() => { go(3); }, 9000);
    setTimeout(() => {
      go(4); setShowCube(false); setShowFlash(true);
      setTimeout(() => setShowFlash(false), 600);
      if (audioCtxRef.current) explosiveBrass(audioCtxRef.current);
    }, 9500);
    setTimeout(() => { go(5); setShowPhone(true); }, 10600);
    setTimeout(() => { go(6); onComplete(); }, 15000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canvas particle engine ────────────────────────────────────────────────
  useEffect(() => {
    if (phase < 1 || phase > 4) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d")!;
    let W = canvas.width, H = canvas.height;
    let pts: Particle[] = [];
    let shards: Particle[] = [];
    let frame = 0;
    let shardsSpawned = false;

    const spawnThread = () => {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 120;
      pts.push({
        x: W / 2 + Math.cos(a) * r,
        y: H / 2 + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        life: 0, maxLife: 180 + Math.random() * 120,
        size: 0.8 + Math.random() * 2,
        hue: 28 + Math.random() * 22,
        trail: [], angle: a, frozen: false, rotAngle: 0,
      });
    };

    const spawnShards = () => {
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 3 + Math.random() * 10;
        shards.push({
          x: W / 2 + (Math.random() - 0.5) * 160,
          y: H / 2 + (Math.random() - 0.5) * 160,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 2,
          life: 0, maxLife: 80 + Math.random() * 60,
          size: 6 + Math.random() * 16,
          hue: 195 + Math.random() * 40,
          trail: [], angle: a,
          rotAngle: Math.random() * Math.PI * 2,
          frozen: false,
        });
      }
    };

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      frame++;
      W = canvas.width; H = canvas.height;
      const p = phaseRef.current;

      if (p === 1 || p === 2) {
        // Fade trail
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(0, 0, W, H);

        // Spawn
        const limit = p === 2 ? 50 : 110;
        if (frame % 4 === 0 && pts.length < limit) spawnThread();
        pts = pts.filter(q => q.life < q.maxLife);

        // Connections
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 75) {
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.strokeStyle = `rgba(255,175,30,${(1 - d / 75) * 0.28})`;
              ctx.lineWidth = 0.5; ctx.stroke();
            }
          }
        }

        for (const q of pts) {
          q.trail.push({ x: q.x, y: q.y });
          if (q.trail.length > 28) q.trail.shift();

          // Drift + pull towards centre in cube phase
          q.vx += Math.sin(q.life * 0.04 + q.angle) * 0.04;
          q.vy += Math.cos(q.life * 0.04 + q.angle) * 0.04;
          if (p === 2) {
            const dx = W / 2 - q.x, dy = H / 2 - q.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 60) { q.vx += (dx / d) * 0.12; q.vy += (dy / d) * 0.12; }
          }
          q.vx *= 0.985; q.vy *= 0.985;
          q.x += q.vx; q.y += q.vy; q.life++;

          const alpha = Math.sin((q.life / q.maxLife) * Math.PI);

          // Trail
          if (q.trail.length > 2) {
            ctx.beginPath();
            ctx.moveTo(q.trail[0].x, q.trail[0].y);
            for (let i = 1; i < q.trail.length; i++) ctx.lineTo(q.trail[i].x, q.trail[i].y);
            ctx.strokeStyle = `hsla(${q.hue},100%,62%,${alpha * 0.5})`;
            ctx.lineWidth = q.size * 0.55;
            ctx.shadowBlur = 8; ctx.shadowColor = `hsla(${q.hue},100%,55%,0.5)`;
            ctx.stroke(); ctx.shadowBlur = 0;
          }

          // Core
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${q.hue},100%,85%,${alpha})`;
          ctx.shadowBlur = 14; ctx.shadowColor = `hsla(${q.hue},100%,60%,0.8)`;
          ctx.fill(); ctx.shadowBlur = 0;
        }

      } else if (p === 3) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(0, 0, W, H);

      } else if (p === 4) {
        ctx.fillStyle = "rgba(0,0,12,0.22)";
        ctx.fillRect(0, 0, W, H);

        if (!shardsSpawned) { spawnShards(); shardsSpawned = true; }

        // Flash burst first frame
        if (frame === 1) {
          const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 350);
          g.addColorStop(0, "rgba(255,255,255,0.95)");
          g.addColorStop(0.3, "rgba(210,230,255,0.5)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }

        // God rays
        for (let r = 0; r < 10; r++) {
          const ang = (r / 10) * Math.PI * 2 + frame * 0.008;
          const grd = ctx.createLinearGradient(W / 2, H / 2,
            W / 2 + Math.cos(ang) * 500, H / 2 + Math.sin(ang) * 500);
          grd.addColorStop(0, `rgba(255,215,80,${0.06 * Math.max(0, 1 - frame / 40)})`);
          grd.addColorStop(1, "rgba(255,180,30,0)");
          ctx.beginPath();
          ctx.moveTo(W / 2, H / 2);
          ctx.arc(W / 2, H / 2, 500, ang - 0.12, ang + 0.12);
          ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
        }

        // Shards
        shards = shards.filter(s => s.life < s.maxLife);
        for (const s of shards) {
          if (!s.frozen) {
            s.x += s.vx; s.y += s.vy;
            s.vy += 0.18; s.vx *= 0.97; s.vy *= 0.97;
            s.life++;
            if (s.life > 18) s.frozen = true;
          }

          const a = Math.max(0, 1 - s.life / s.maxLife);
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rotAngle + s.life * 0.018);
          const sz = s.size;
          // Irregular shard polygon
          ctx.beginPath();
          ctx.moveTo(0, -sz);
          ctx.lineTo(sz * 0.55, -sz * 0.2);
          ctx.lineTo(sz * 0.8, sz * 0.45);
          ctx.lineTo(sz * 0.1, sz * 0.75);
          ctx.lineTo(-sz * 0.65, sz * 0.35);
          ctx.lineTo(-sz * 0.4, -sz * 0.55);
          ctx.closePath();
          ctx.fillStyle = `rgba(190,225,255,${a * 0.38})`;
          ctx.strokeStyle = `rgba(220,245,255,${a * 0.9})`;
          ctx.lineWidth = 1;
          ctx.shadowBlur = 10; ctx.shadowColor = `rgba(255,220,80,${a * 0.5})`;
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
    };

    loop();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase >= 1]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999999,
      background: "#00000f", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Skip button */}
      <button
        onClick={onComplete}
        style={{
          position: "absolute",
          top: 24,
          right: 28,
          zIndex: 1000,
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          color: "rgba(255, 255, 255, 0.75)",
          borderRadius: 20,
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 1,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          transition: "all 0.2s ease"
        }}
      >
        Skip ✕
      </button>

      {/* Canvas layer */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />

      {/* ── IDLE: Start Button ── */}
      <AnimatePresence>
        {phase === 0 && (
          <motion.div key="start"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.6 }}
            style={{ position: "relative", zIndex: 10, textAlign: "center" }}>
            {/* Ambient pulse ring */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                width: 240, height: 240, borderRadius: "50%",
                border: "1px solid rgba(120,50,255,0.4)",
                pointerEvents: "none",
              }}
            />
            <motion.button onClick={handleStart}
              animate={{ boxShadow: [
                "0 0 20px rgba(120,50,255,0.2), inset 0 0 20px rgba(120,50,255,0.05)",
                "0 0 50px rgba(120,50,255,0.6), inset 0 0 30px rgba(120,50,255,0.15)",
                "0 0 20px rgba(120,50,255,0.2), inset 0 0 20px rgba(120,50,255,0.05)",
              ]}}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                padding: "18px 52px", fontSize: 11, fontWeight: 700,
                letterSpacing: 8, textTransform: "uppercase",
                background: "rgba(10,0,30,0.7)", color: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(120,50,255,0.5)", borderRadius: 100,
                cursor: "pointer", fontFamily: "'Inter', sans-serif",
                backdropFilter: "blur(20px)", position: "relative",
              }}>
              Initialize System
            </motion.button>
            <motion.p
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 5, marginTop: 20, textTransform: "uppercase" }}>
              CLARIVOX · Neural Interface · v2.0
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GLASS CUBE ── */}
      <AnimatePresence>
        {showCube && (
          <motion.div key="cube"
            initial={{ opacity: 0, scale: 0.4, rotateX: 30 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 3, filter: "blur(40px)" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute", zIndex: 5,
              width: 220, height: 220,
              background: "rgba(255,255,255,0.02)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6,
              boxShadow: `
                inset 0 0 80px rgba(255,150,20,0.35),
                0 0 100px rgba(255,150,20,0.25),
                0 0 40px rgba(255,200,50,0.12)
              `,
              animation: cubeShaking ? "cubeShake 0.08s infinite" : "none",
              overflow: "hidden",
            }}>

            {/* Inner molten energy */}
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 0.65, repeat: Infinity }}
              style={{
                position: "absolute", inset: 16, borderRadius: 4,
                background: "radial-gradient(ellipse at center, rgba(255,170,20,0.7) 0%, rgba(255,80,0,0.25) 55%, transparent 100%)",
                filter: "blur(10px)",
              }}
            />

            {/* Top face reflection */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "45%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",
            }} />

            {/* SVG Cracks */}
            <svg width="100%" height="100%" viewBox="0 0 220 220" style={{ position: "absolute", inset: 0 }}>
              <AnimatePresence>
                {crackLevel >= 1 && (
                  <motion.path key="c1"
                    d="M 55 0 L 70 55 L 42 90 L 65 145 L 38 220"
                    fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.6))" }}
                  />
                )}
                {crackLevel >= 1 && (
                  <motion.path key="c1b"
                    d="M 42 90 L 20 110 L 35 130"
                    fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.2, delay: 0.15, ease: "easeOut" }}
                  />
                )}
                {crackLevel >= 2 && (
                  <motion.path key="c2"
                    d="M 220 50 L 158 85 L 178 130 L 132 175 L 155 220"
                    fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.5))" }}
                  />
                )}
                {crackLevel >= 3 && (
                  <>
                    <motion.path key="c3"
                      d="M 0 118 L 68 98 L 105 135 L 178 108 L 220 125"
                      fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    />
                    <motion.path key="c4"
                      d="M 70 55 L 105 100 L 90 135 L 132 175"
                      fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    />
                    <motion.path key="c5"
                      d="M 105 0 L 118 48 L 95 72 L 105 100"
                      fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.15, delay: 0.08, ease: "easeOut" }}
                    />
                  </>
                )}
              </AnimatePresence>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SHATTER FLASH ── */}
      <AnimatePresence>
        {showFlash && (
          <motion.div key="flash"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            style={{
              position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.92) 0%, rgba(210,230,255,0.5) 25%, transparent 65%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ── PHONE REVEAL ── */}
      <AnimatePresence>
        {showPhone && (
          <motion.div key="phone"
            initial={{ opacity: 0, scale: 0.1, rotateY: 120 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute", zIndex: 10,
              width: 210, height: 380, borderRadius: 36,
              border: "2px solid rgba(255,255,255,0.25)",
              background: "linear-gradient(160deg, rgba(18,18,40,0.95), rgba(4,4,20,0.98))",
              boxShadow: `
                0 0 80px rgba(120,50,255,0.6),
                0 0 160px rgba(0,200,255,0.2),
                0 40px 80px rgba(0,0,0,0.8),
                inset 0 0 40px rgba(0,0,0,0.5)
              `,
              overflow: "hidden",
              perspective: 1000,
            }}>

            {/* Notch */}
            <div style={{
              position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
              width: 64, height: 8, borderRadius: 4,
              background: "rgba(0,0,0,0.85)", zIndex: 3,
            }} />

            {/* Screen */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 1 }}
              style={{
                position: "absolute", inset: 10, borderRadius: 28,
                background: "linear-gradient(160deg, #020818, #050028)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", overflow: "hidden",
              }}>

              {/* Volumetric God Rays */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.7, 0.4] }}
                transition={{ delay: 0.8, duration: 1.5 }}
                style={{
                  position: "absolute", inset: 0,
                  background: `
                    conic-gradient(from 200deg at 50% 110%,
                      rgba(120,50,255,0.5) 0deg, transparent 25deg,
                      transparent 60deg, rgba(0,200,255,0.3) 80deg,
                      transparent 100deg, transparent 280deg,
                      rgba(120,50,255,0.5) 360deg)
                  `,
                  filter: "blur(16px)",
                }}
              />

              {/* Scan line animation */}
              <motion.div
                initial={{ y: -200 }}
                animate={{ y: 600 }}
                transition={{ delay: 0.7, duration: 1.2, ease: "easeInOut" }}
                style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, rgba(0,240,255,0.8), transparent)",
                  boxShadow: "0 0 20px rgba(0,240,255,0.5)",
                }}
              />

              {/* CLARIVOX Logo */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{
                  fontSize: 32, fontWeight: 900, letterSpacing: 5,
                  background: "linear-gradient(135deg, #ffffff, #a855f7, #00f0ff)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 12px rgba(120,50,255,0.9))",
                }}>CLARIVOX</div>
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                  style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,240,255,0.8), transparent)", margin: "8px 0" }}
                />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.7, duration: 0.5 }}
                  style={{ fontSize: 7, letterSpacing: 5, color: "rgba(0,240,255,0.7)", textTransform: "uppercase" }}>
                  Neural Interface Online
                </motion.div>
              </motion.div>

              {/* Pulsing status dots */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 0.5 }}
                style={{ display: "flex", gap: 6, marginTop: 20, position: "relative", zIndex: 2 }}>
                {["#00f0ff", "#a855f7", "#10b981"].map((color, i) => (
                  <motion.div key={i}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.2, delay: i * 0.4, repeat: Infinity }}
                    style={{ width: 5, height: 5, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }}
                  />
                ))}
              </motion.div>
            </motion.div>

            {/* Edge reflections */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "30%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)",
              borderRadius: "36px 36px 0 0", pointerEvents: "none",
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CSS for cube shake ── */}
      <style>{`
        @keyframes cubeShake {
          0%   { transform: translate(0,0) rotate(0deg); }
          20%  { transform: translate(-4px, 3px) rotate(-0.6deg); }
          40%  { transform: translate(4px,-2px) rotate(0.5deg); }
          60%  { transform: translate(-3px, 4px) rotate(-0.3deg); }
          80%  { transform: translate(3px,-3px) rotate(0.6deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
