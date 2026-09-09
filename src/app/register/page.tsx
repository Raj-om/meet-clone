"use client"

import { useActionState } from "react"
import { registerAction } from "@/app/actions/authActions"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"

const RegisterBackground = dynamic(
  () => import("@/components/PageBackgrounds").then(m => m.RegisterBackground),
  { ssr: false }
)

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, null)

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#000d08", fontFamily: "'Inter', sans-serif", position: "relative",
      padding: "20px", boxSizing: "border-box", overflowX: "hidden"
    }}>
      <RegisterBackground />
      {/* Background Award Spotlight effect */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "100vw", height: "100vw", maxWidth: 800, maxHeight: 800,
        background: "radial-gradient(circle, rgba(255,215,0,0.12) 0%, rgba(16,185,129,0.06) 40%, transparent 70%)",
        animation: "pulse-glow-green 4s infinite alternate", pointerEvents: "none", zIndex: 0
      }} />

      {/* Award-winner keyframes */}
      <style>{`
        @keyframes rotate-rays-green {
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-glow-green {
          0%   { box-shadow: 0 0 10px rgba(16,185,129,0.4), 0 0 20px rgba(16,185,129,0.15); }
          100% { box-shadow: 0 0 22px rgba(255,215,0,0.5), 0 0 45px rgba(16,185,129,0.4), 0 0 70px rgba(255,215,0,0.1); }
        }
        .award-icon-wrap-g {
          position: relative; width: 58px; height: 58px;
          margin: 0 auto 10px; border-radius: 16px;
          overflow: visible;
          animation: pulse-glow-green 2s infinite alternate;
        }
        .award-icon-wrap-g::before {
          content: '';
          position: absolute; top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: conic-gradient(
            transparent 0deg, rgba(255,215,0,0.4) 40deg,
            transparent 80deg, rgba(16,185,129,0.3) 125deg,
            transparent 170deg, rgba(255,215,0,0.4) 215deg,
            transparent 260deg, rgba(16,185,129,0.3) 305deg,
            transparent 360deg
          );
          animation: rotate-rays-green 6s linear infinite;
          border-radius: 50%; z-index: 0;
        }
        .award-icon-inner-g {
          position: relative; z-index: 1;
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #065f46, #10b981);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 30px rgba(16,185,129,0.4), 0 0 60px rgba(16,185,129,0.15);
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
          border: "1px solid rgba(0,220,180,0.2)",
          borderRadius: 24, boxSizing: "border-box",
          boxShadow: "0 0 0 1px rgba(255,215,0,0.08), 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1), 0 0 30px rgba(0,200,150,0.06)",
        }}>

        {/* Rotating rays on card edge */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 24,
          overflow: "hidden", pointerEvents: "none", zIndex: 0,
        }}>
          <div style={{
            position: "absolute", top: "-50%", left: "-50%",
            width: "200%", height: "200%",
            background: `conic-gradient(
              transparent 0deg, rgba(255,215,0,0.1) 45deg,
              transparent 90deg, rgba(16,185,129,0.07) 135deg,
              transparent 180deg, rgba(255,215,0,0.1) 225deg,
              transparent 270deg, rgba(16,185,129,0.07) 315deg,
              transparent 360deg
            )`,
            animation: "rotate-rays-green 10s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 1, borderRadius: 23,
            background: "linear-gradient(145deg, rgba(4,18,12,0.97), rgba(0,8,6,0.97))",
          }} />
        </div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
            <div className="award-icon-wrap-g">
              <div className="award-icon-inner-g">
                <span style={{ fontSize: 24 }}>✦</span>
              </div>
            </div>
            <h1 style={{
              fontSize: "clamp(1.3rem, 5vw, 1.65rem)", fontWeight: 800, letterSpacing: -0.5,
              color: "#fff", marginBottom: "0.2rem", margin: 0,
            }}>Join Clarivox</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginTop: 4 }}>
              The AI-native secure video platform
            </p>
          </div>

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {state?.error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                style={{ padding: "0.6rem 0.9rem", background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                  border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: "0.8rem" }}>
                {state.error}
              </motion.div>
            )}

            {[
              { id: "name",     label: "Full Name",     type: "text",     placeholder: "John Doe" },
              { id: "email",    label: "Email Address", type: "email",    placeholder: "you@example.com" },
              { id: "password", label: "Password",      type: "password", placeholder: "Create a strong password" },
            ].map(field => (
              <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label htmlFor={field.id} style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: 0.3 }}>
                  {field.label}
                </label>
                <input id={field.id} name={field.id} type={field.type} required placeholder={field.placeholder}
                  minLength={field.id === "password" ? 6 : undefined}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.88rem",
                    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
                    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)", transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(16,185,129,0.6)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            ))}

            <motion.button type="submit" disabled={isPending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                marginTop: "0.2rem", height: 44, width: "100%", cursor: isPending ? "not-allowed" : "pointer",
                background: "linear-gradient(90deg, #065f46, #10b981)", border: "none",
                borderRadius: 12, color: "#fff", fontSize: "0.9rem", fontWeight: 700,
                fontFamily: "inherit", boxShadow: "0 8px 20px rgba(16,185,129,0.28)",
                transition: "box-shadow 0.3s ease", opacity: isPending ? 0.7 : 1,
              }}>
              {isPending ? "Creating account..." : "Sign Up →"}
            </motion.button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#34d399", fontWeight: 600, textDecoration: "none" }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
