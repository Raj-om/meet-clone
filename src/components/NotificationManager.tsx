"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"

export default function NotificationManager({ meetingId }: { meetingId: string }) {
    const [email, setEmail] = useState("")
    const [status, setStatus] = useState<string | null>(null)

    const requestPushPermission = async () => {
        if (!("Notification" in window)) {
            setStatus("Browser does not support notifications.")
            return
        }

        const permission = await Notification.requestPermission()
        if (permission === "granted") {
            new Notification("Notifications Enabled", {
                body: "You will now receive upcoming meeting alerts."
            })
            setStatus("Push notifications enabled")
        } else {
            setStatus("Push notifications denied")
        }
    }

    const sendEmailInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setStatus("Sending invite...")
        try {
            const res = await fetch("/api/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, meetingId, type: "invite" })
            })

            const data = await res.json()
            if (data.success) {
                setStatus("Invite sent successfully!")
                console.log("Check ethereal email link:", data.testUrl)
                setEmail("")
            } else {
                setStatus("Failed to send invite.")
            }
        } catch (e) {
            setStatus("Error sending invite.")
        }
    }

    return (
        <div className="glass-panel" style={{ padding: "1.5rem", marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 500 }}>Meeting Actions</h3>

            <form onSubmit={sendEmailInvite} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Invite via email"
                    className="join-input"
                    style={{ flex: 1, padding: "0.5rem" }}
                    required
                />
                <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>Invite</button>
            </form>

            <button onClick={requestPushPermission} className="btn btn-outline" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                Enable Push Alerts
            </button>

            {status && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>{status}</p>}
        </div>
    )
}
