"use client"

import { useActionState } from "react"
import { loginAction } from "@/app/actions/authActions"
import Link from "next/link"
import { signIn } from "next-auth/react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"

const LoginBackground = dynamic(
  () => import("@/components/PageBackgrounds").then(m => m.LoginBackground),
  { ssr: false }
)

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#0a0010", fontFamily: "'Inter', sans-serif", position: "relative",
      padding: "20px", boxSizing: "border-box", overflowX: "hidden"
    }}>
      <LoginBackground />
      {/* Background Award Spotlight effect */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "100vw", height: "100vw", maxWidth: 800, maxHeight: 800,
        background: "radial-gradient(circle, rgba(255,215,0,0.15) 0%, rgba(180,80,255,0.05) 40%, transparent 70%)",
        animation: "pulse-glow 4s infinite alternate", pointerEvents: "none", zIndex: 0
      }} />

      {/* Award-winner rotating rays keyframes */}
      <style>{`
        @keyframes rotate-rays {
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%   { box-shadow: 0 0 10px rgba(255,215,0,0.35), 0 0 20px rgba(180,80,255,0.2); }
          100% { box-shadow: 0 0 22px rgba(255,215,0,0.7), 0 0 45px rgba(180,80,255,0.4), 0 0 70px rgba(255,215,0,0.1); }
        }
        .award-icon-wrap {
          position: relative;
          width: 62px; height: 62px;
          margin: 0 auto 12px;
          border-radius: 18px;
          overflow: visible;
          animation: pulse-glow 2s infinite alternate;
        }
        .award-icon-wrap::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: conic-gradient(
            transparent 0deg,
            rgba(255,215,0,0.45) 40deg,
            transparent 85deg,
            rgba(180,80,255,0.35) 130deg,
            transparent 175deg,
            rgba(255,215,0,0.45) 220deg,
            transparent 265deg,
            rgba(180,80,255,0.35) 310deg,
            transparent 360deg
          );
          animation: rotate-rays 6s linear infinite;
          border-radius: 50%;
          z-index: 0;
        }
        .award-icon-inner {
          position: relative; z-index: 1;
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 30px rgba(124,58,237,0.5), 0 0 60px rgba(124,58,237,0.2);
        }
      `}</style>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "relative", zIndex: 10,
          width: "100%", maxWidth: 380, margin: "auto",
          padding: "clamp(24px, 6vw, 36px) clamp(20px, 6vw, 32px)",
          background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(0,0,0,0.4))",
          backdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(180,100,255,0.25)",
          borderRadius: 24, boxSizing: "border-box",
          boxShadow: "0 0 0 1px rgba(255,215,0,0.1), 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1), 0 0 30px rgba(140,0,255,0.06)",
        }}>

        {/* Rotating rays on card edge */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden",
          pointerEvents: "none", zIndex: 0,
        }}>
          <div style={{
            position: "absolute", top: "-50%", left: "-50%",
            width: "200%", height: "200%",
            background: `conic-gradient(
              transparent 0deg, rgba(255,215,0,0.12) 45deg,
              transparent 90deg, rgba(180,80,255,0.08) 135deg,
              transparent 180deg, rgba(255,215,0,0.12) 225deg,
              transparent 270deg, rgba(180,80,255,0.08) 315deg,
              transparent 360deg
            )`,
            animation: "rotate-rays 10s linear infinite",
          }} />
          {/* Dark overlay so rays only show at edges */}
          <div style={{
            position: "absolute", inset: 1, borderRadius: 23,
            background: "linear-gradient(145deg, rgba(18,5,40,0.97), rgba(5,0,20,0.97))",
          }} />
        </div>

        {/* Content (above the ray overlay) */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div className="award-icon-wrap">
              <div className="award-icon-inner">
                <span style={{ fontSize: 26 }}>⚡</span>
              </div>
            </div>
            <h1 style={{
              fontSize: "clamp(1.4rem, 5vw, 1.75rem)", fontWeight: 800, letterSpacing: -0.5,
              background: "linear-gradient(135deg, #c084fc, #818cf8, #06b6d4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: "0.2rem", margin: 0,
            }}>AEXIS</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", marginTop: 4 }}>
              Sign in to your Aexis account
            </p>
          </div>

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {state?.error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                style={{ padding: "0.6rem 0.9rem", background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                  border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: "0.82rem" }}>
                {state.error}
              </motion.div>
            )}

            {[
              { id: "email", label: "Email Address", type: "email", placeholder: "you@example.com" },
              { id: "password", label: "Password", type: "password", placeholder: "••••••••" },
            ].map(field => (
              <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label htmlFor={field.id} style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: 0.3 }}>
                  {field.label}
                </label>
                <input id={field.id} name={field.id} type={field.type} required placeholder={field.placeholder}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: "0.65rem 0.9rem", color: "#fff", fontSize: "0.9rem",
                    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
                    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)", transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(168,85,247,0.6)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            ))}

            <motion.button type="submit" disabled={isPending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                marginTop: "0.3rem", height: 46, width: "100%", cursor: isPending ? "not-allowed" : "pointer",
                background: "linear-gradient(90deg, #7c3aed, #a855f7)", border: "none",
                borderRadius: 12, color: "#fff", fontSize: "0.92rem", fontWeight: 700,
                fontFamily: "inherit", boxShadow: "0 8px 20px rgba(124,58,237,0.35)",
                transition: "box-shadow 0.3s ease", opacity: isPending ? 0.7 : 1,
              }}>
              {isPending ? "Signing in..." : "Sign In →"}
            </motion.button>
          </form>

          <div style={{ marginTop: "0.8rem" }}>
            <motion.button onClick={() => signIn("google", { callbackUrl: "/" })}
              whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.08)" }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: "100%", padding: "0.65rem", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: "0.85rem",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                fontFamily: "inherit", transition: "background 0.2s",
              }}>
              <span style={{ fontSize: "1rem" }}>🔵</span> Continue with Google
            </motion.button>
          </div>

          <p style={{ textAlign: "center", marginTop: "1.1rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.4)" }}>
            New to Aexis?{" "}
            <Link href="/register" style={{ color: "#c084fc", fontWeight: 600, textDecoration: "none" }}>
              Create account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
