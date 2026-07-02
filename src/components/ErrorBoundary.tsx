"use client"

import React, { ErrorInfo, ReactNode } from "react"

interface Props {
    children: ReactNode
    fallbackText?: string
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Nervous System caught an error:", error, errorInfo)
        
        // Broadcast to the event bus if needed (optional integration)
        if (typeof window !== "undefined") {
            const event = new CustomEvent('app:crash', { detail: { error: error.message } })
            window.dispatchEvent(event)
        }
    }

    resetBoundary = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: "20px",
                    background: "rgba(220, 38, 38, 0.1)", // Subtle red tint
                    border: "1px solid rgba(220, 38, 38, 0.3)",
                    borderRadius: "16px",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: "white",
                    fontFamily: "var(--font-geist-sans), sans-serif",
                    height: "100%",
                    minHeight: "150px"
                }}>
                    <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        background: "rgba(220, 38, 38, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "12px",
                        fontSize: "24px"
                    }}>
                        🩹
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600 }}>
                        {this.props.fallbackText || "Component Offline"}
                    </h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "rgba(255, 255, 255, 0.6)", maxWidth: "80%" }}>
                        A minor subsystem crashed, but the rest of the app is safe.
                    </p>
                    <button
                        onClick={this.resetBoundary}
                        style={{
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "white",
                            padding: "6px 14px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                    >
                        Attempt Reboot
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
