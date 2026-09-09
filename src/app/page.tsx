"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState, type SVGProps } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { useThunder } from "@/hooks/useThunder";
import "./globals.css";

const PremiumBackground = dynamic(() => import("@/components/PremiumBackground"), { ssr: false });
const CinematicIntro = dynamic(() => import("@/components/CinematicIntro").then(m => m.CinematicIntro), { ssr: false });

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type IconProps = SVGProps<SVGSVGElement>;

const VideoIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}><rect x="2.5" y="5.5" width="13" height="13" stroke="currentColor" strokeWidth="2" /><path d="m15.5 10 5-2.7v9.4l-5-2.7v-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
);
const ArrowIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
);

// ── Clarivox Brand Logo ───────────────────────────────────
function VolcanoLogo() {
  return (
    <motion.div
      initial={{ y: 20, scale: 0.8, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={{ 
        duration: 0.8, 
        ease: "easeOut",
        type: "spring", stiffness: 100, damping: 12
      }}
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <img
        src="/clarivox-logo.png"
        alt="CLARIVOX"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          boxShadow: "0 0 15px rgba(124,58,237,0.8)",
          flexShrink: 0
        }}
      />
      <motion.span
        animate={{ 
          textShadow: [
            "0px 0px 15px rgba(167, 139, 250, 0.6), 0px 0px 30px rgba(6, 182, 212, 0.4)",
            "0px 0px 25px rgba(167, 139, 250, 0.9), 0px 0px 45px rgba(6, 182, 212, 0.7)",
            "0px 0px 15px rgba(167, 139, 250, 0.6), 0px 0px 30px rgba(6, 182, 212, 0.4)"
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          fontSize: 22, 
          fontWeight: 900, 
          letterSpacing: 3, 
          background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          display: "inline-block",
        }}
      >
        CLARIVOX
      </motion.span>
    </motion.div>
  );
}


// ── Holographic Custom Cursor ───────────────────────────────────────────
function CustomCursor() {
  const cx = useMotionValue(-100), cy = useMotionValue(-100);
  const sx = useSpring(cx, { stiffness: 400, damping: 25 });
  const sy = useSpring(cy, { stiffness: 400, damping: 25 });
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      setIsTouch(true);
      return;
    }
    const move = (e: MouseEvent) => { cx.set(e.clientX); cy.set(e.clientY); };
    const down = () => setClicked(true);
    const up = () => setClicked(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    const onEnter = () => setHovered(true);
    const onLeave = () => setHovered(false);
    document.querySelectorAll("button, input, a").forEach(el => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    });
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, [cx, cy]);

  if (isTouch) return null;

  return (
    <>
      {/* Core Dot */}
      <motion.div style={{
        position: "fixed", left: cx, top: cy, zIndex: 9999, pointerEvents: "none",
        width: 6, height: 6, background: "#ffffff", translateX: "-50%", translateY: "-50%",
        borderRadius: "50%", mixBlendMode: "difference"
      }} />
      {/* Holographic Trailing Ring */}
      <motion.div style={{
        position: "fixed", left: sx, top: sy, zIndex: 9998, pointerEvents: "none",
        width: hovered ? 60 : 40, height: hovered ? 60 : 40,
        border: `1px solid ${hovered ? "rgba(0,255,255,0.8)" : "rgba(255,255,255,0.4)"}`,
        backgroundColor: hovered ? "rgba(0,255,255,0.05)" : "transparent",
        translateX: "-50%", translateY: "-50%",
        boxShadow: hovered ? "0 0 20px rgba(0,255,255,0.5), inset 0 0 10px rgba(0,255,255,0.3)" : "none",
        transition: "width .3s, height .3s, border-color .3s, background-color .3s, box-shadow .3s",
        borderRadius: "50%",
        transform: clicked ? "scale(0.8) translate(-50%, -50%)" : "translate(-50%, -50%)",
        backdropFilter: hovered ? "blur(4px)" : "none"
      }} />
    </>
  );
}

// ── Cyber Card ───────────────────────────────────────────────────────────────
function CyberCard({ children, delay = 0, style = {} }: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null);
  
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      style={{
        background: "rgba(13, 13, 26, 0.75)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(0, 240, 255, 0.3)",
        boxShadow: "inset 0 0 20px rgba(0, 240, 255, 0.1), 0 0 15px rgba(0, 0, 0, 0.5)",
        clipPath: "polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)",
        position: "relative",
        ...style
      }}>
      {/* Decorative Cyber Corners */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 20, height: 2, background: "#00f0ff" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: 20, background: "#00f0ff" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 20, height: 2, background: "#ff007f" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 2, height: 20, background: "#ff007f" }} />
      
      {children}
    </motion.div>
  );
}

// ── Glitch Text Reveal ────────────────────────────────────────────────────────────
function GlitchText({ text, delay = 0, style = {} }: { text: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <motion.span style={{ display: "inline-flex", flexWrap: "wrap", ...style }}>
      {text.split("").map((ch, i) => (
        <motion.span key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + i * 0.05, duration: 0.1 }}
          style={{ display: "inline-block", whiteSpace: "pre" }}>
          {ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ── HUD Ring ────────────────────────────────────────────────────────────────
function CyberRing({ value, label, color, size = 76 }: { value: number; label: string; color: string; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3} strokeDasharray="4 2" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (value / 100) * c }}
          transition={{ duration: 1.5, delay: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize={14} fontWeight="900"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px`, textShadow: `0 0 5px ${color}` }}>{value}%</text>
      </svg>
      <span style={{ fontSize: 9, color: "rgba(0, 240, 255, 0.7)", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [meetingCode, setMeetingCode] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const { triggerThunder } = useThunder();
  // Intro finished by default for immediate responsiveness
  const [introFinished, setIntroFinished] = useState(true);

  useEffect(() => {
    setMounted(true);
    const handleInstall = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handleInstall);
    const tick = setInterval(() => setTime(new Date().toLocaleTimeString("en-US", { hour12: false })), 1000);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstall);
      clearInterval(tick);
    };
  }, []);

  const handleIntroComplete = () => {
    sessionStorage.setItem('aexis-intro-done', '1');
    setIntroFinished(true);
  };

  const startNewMeeting = (e?: React.MouseEvent<HTMLButtonElement>) => {
    const code = Math.floor(100000000 + Math.random() * 900000000).toString();
    try {
      sessionStorage.setItem(`meet-host-${code}`, "true");
    } catch (err) {
      console.warn("Storage warning:", err);
    }
    // Visual feedback without blocking navigation
    try {
      if (e?.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ox = rect.left + rect.width / 2;
        const oy = rect.top + rect.height / 2;
        triggerThunder(ox, oy, () => {});
      }
    } catch (err) {
      console.warn("Thunder visual error:", err);
    }
    router.push(`/meet/${code}/lobby`);
  };

  const joinMeeting = (e?: React.MouseEvent<HTMLButtonElement>) => {
    const code = meetingCode.trim().replace(/[^a-zA-Z0-9]/g, "");
    if (!code) return;
    try {
      if (e?.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ox = rect.left + rect.width / 2;
        const oy = rect.top + rect.height / 2;
        triggerThunder(ox, oy, () => {});
      }
    } catch (err) {
      console.warn("Thunder visual error:", err);
    }
    router.push(`/meet/${code}/lobby`);
  };

  const installApp = async () => {
    if (!installPrompt) { router.push("/install"); return; }
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstallPrompt(null);
    } catch {
      router.push("/install");
    }
  };

  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || "GUEST";
  const initial = firstName.charAt(0).toUpperCase();
  if (!mounted) return null;

  return (
    <>
      <div style={{
        width: "100vw", height: "100vh", background: "#020818",
        overflow: "hidden", position: "relative", cursor: "default",
        fontFamily: "'Inter', sans-serif", color: "#fff",
        opacity: 1,
        pointerEvents: "auto",
      }}>
        <CustomCursor />
        
        {/* Premium Aurora Background */}
        <PremiumBackground />

        {/* UI Overlay */}
        <div style={{ position: "absolute", inset: 0, zIndex: 4, display: "flex", flexDirection: "column" }}>

        {/* ── SPATIAL NAV ── */}
        <motion.nav initial={{ opacity: 0, x: "-50%", y: -20 }} animate={{ opacity: 1, x: "-50%", y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute", top: 16, left: "50%",
            width: "min(calc(100% - 24px), 1200px)", height: 56,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 18px", borderRadius: 100,
            background: "rgba(20, 20, 20, 0.65)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)"
          }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <VolcanoLogo />
          </div>

          {/* Clock (hidden on narrow screens to prevent overlap) */}
          <div className="hidden md:block" style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>
            {time} <span style={{ fontSize: 10, opacity: 0.5 }}>UTC</span>
          </div>

          {/* Auth actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <motion.button className="spatial-btn" onClick={installApp} style={{ cursor: "pointer", fontSize: 12, padding: "6px 14px" }}>
              {installPrompt ? "Install App" : "Get App"}
            </motion.button>

            {session?.user ? (
              <motion.button className="spatial-btn" onClick={() => signOut()}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", cursor: "pointer" }}>
                <span style={{
                  width: 22, height: 22, background: "#fff", color: "#000", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700
                }}>{initial}</span>
                <span className="hidden sm:inline">{firstName}</span>
              </motion.button>
            ) : (
              <>
                <Link href="/login" className="spatial-btn" style={{ textDecoration: "none", cursor: "pointer", fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center", color: "#fff" }}>
                  Sign In
                </Link>
                <Link href="/register" className="spatial-btn spatial-btn-primary" style={{ textDecoration: "none", cursor: "pointer", fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center" }}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </motion.nav>

        {/* ── SPATIAL CENTER CARD ── */}
        <motion.div className="spatial-card"
          initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }} 
          animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute", top: "50%", left: "50%",
            padding: "48px 40px", width: "min(440px, 92vw)",
            display: "flex", flexDirection: "column", alignItems: "center",
            zIndex: 10
          }}>
          
          <h2 className="text-gradient" style={{ 
            fontSize: 28, fontWeight: 700, letterSpacing: -1, marginBottom: 40, textAlign: "center" 
          }}>
            Start a Session
          </h2>
          
          {/* New Meeting */}
          <motion.button className="spatial-btn spatial-btn-primary"
            onClick={startNewMeeting}
            whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(0,200,255,0.4), 0 0 60px rgba(0,100,255,0.2)" }}
            whileTap={{ scale: 0.97 }}
            style={{ width: "100%", height: 52, display: "flex", gap: 10, fontSize: 15,
              boxShadow: "0 4px 20px rgba(255,255,255,0.1)", transition: "box-shadow 0.3s ease", cursor: "pointer" }}>
            <VideoIcon style={{ width: 20 }} />
            New Secure Call
          </motion.button>

          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "32px 0", width: "100%", opacity: 0.4 }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #fff)" }} />
            <span style={{ fontSize: 11, color: "#fff", letterSpacing: 1, fontWeight: 600 }}>OR JOIN</span>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(270deg, transparent, #fff)" }} />
          </div>

          {/* Join Meeting */}
          <div style={{
            display: "flex", height: 52, width: "100%",
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 100, overflow: "hidden",
            boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)"
          }}>
            <input
              placeholder="Enter meeting code"
              value={meetingCode}
              onChange={e => setMeetingCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && joinMeeting()}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#fff", fontSize: 15, padding: "0 24px",
                fontFamily: "inherit", fontWeight: 500
              }}
            />
            <motion.button className="spatial-btn"
              onClick={(e) => joinMeeting(e as unknown as React.MouseEvent<HTMLButtonElement>)} 
              disabled={!meetingCode.trim()}
              whileHover={meetingCode.trim() ? { backgroundColor: "rgba(0,200,255,0.15)" } : {}}
              style={{
                height: "100%", padding: "0 28px", borderRadius: 0, border: "none",
                borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                color: meetingCode.trim() ? "#fff" : "rgba(255, 255, 255, 0.3)",
                opacity: meetingCode.trim() ? 1 : 0.5, cursor: meetingCode.trim() ? "pointer" : "not-allowed"
              }}>
              Join ⚡
            </motion.button>
          </div>
        </motion.div>

      </div>
    </div>
    </>
  );
}
