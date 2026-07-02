"use client"

import { useActionState } from "react"
import { loginAction } from "@/app/actions/authActions"
import Link from "next/link"
import { signIn } from "next-auth/react"

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState(loginAction, null)

    return (
        <div className="home-container" style={{ justifyContent: "center", alignItems: "center" }}>
            <div className="glass-panel" style={{ padding: "2.5rem", width: "100%", maxWidth: "420px" }}>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Sign in to Meet Clone</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        Continue to an ad-free video meeting experience.
                    </p>
                </div>

                <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {state?.error && (
                        <div style={{ padding: "0.75rem", background: "var(--danger-color)", color: "white", borderRadius: "6px", fontSize: "0.9rem", opacity: 0.9 }}>
                            {state.error}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label htmlFor="email" style={{ fontSize: "0.9rem", fontWeight: 500 }}>Email Address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="join-input"
                            style={{ width: "100%" }}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label htmlFor="password" style={{ fontSize: "0.9rem", fontWeight: 500 }}>Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="join-input"
                            style={{ width: "100%" }}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: "100%", marginTop: "0.5rem" }}
                        disabled={isPending}
                    >
                        {isPending ? "Signing in..." : "Sign In with Email"}
                    </button>
                </form>

                <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0", gap: "10px" }}>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>or</span>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
                </div>

                <button
                    onClick={() => signIn("google", { callbackUrl: "/" })}
                    style={{
                        width: "100%", padding: "0.75rem", borderRadius: "8px",
                        background: "#fff", color: "#000", border: "none",
                        fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
                    <p style={{ color: "var(--text-muted)" }}>
                        Don&apos;t have an account? <Link href="/register" style={{ color: "var(--accent-color)", fontWeight: 500 }}>Create account</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
