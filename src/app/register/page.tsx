"use client"

import { useActionState } from "react"
import { registerAction } from "@/app/actions/authActions"
import Link from "next/link"

export default function RegisterPage() {
    const [state, formAction, isPending] = useActionState(registerAction, null)

    return (
        <div className="home-container" style={{ justifyContent: "center", alignItems: "center" }}>
            <div className="glass-panel" style={{ padding: "2.5rem", width: "100%", maxWidth: "420px" }}>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Create your account</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        Join Meet Clone to host your own meetings effortlessly.
                    </p>
                </div>

                <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {state?.error && (
                        <div style={{ padding: "0.75rem", background: "var(--danger-color)", color: "white", borderRadius: "6px", fontSize: "0.9rem", opacity: 0.9 }}>
                            {state.error}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label htmlFor="name" style={{ fontSize: "0.9rem", fontWeight: 500 }}>Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="join-input"
                            style={{ width: "100%" }}
                            placeholder="John Doe"
                        />
                    </div>

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
                            placeholder="Create a strong password"
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: "100%", marginTop: "0.5rem" }}
                        disabled={isPending}
                    >
                        {isPending ? "Creating account..." : "Sign Up"}
                    </button>
                </form>

                <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
                    <p style={{ color: "var(--text-muted)" }}>
                        Already have an account? <Link href="/login" style={{ color: "var(--accent-color)", fontWeight: 500 }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
