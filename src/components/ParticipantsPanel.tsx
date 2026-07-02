"use client"

interface Participant {
    userId: string
    displayName: string
    isMuted: boolean
    isVideoOff: boolean
    handRaised: boolean
    isHost: boolean
}

interface Props {
    participants: Participant[]
    currentUserId: string
    isHost: boolean
    onMuteAll: () => void
    onMuteUser: (userId: string) => void
    onKickUser: (userId: string) => void
    onToggleHand: () => void
    handRaised: boolean
}

export default function ParticipantsPanel({ participants, currentUserId, isHost, onMuteAll, onMuteUser, onKickUser, onToggleHand, handRaised }: Props) {
    return (
        <div style={{ color: "white", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "8px 0 12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {isHost && (
                    <button onClick={onMuteAll} style={{
                        background: "#3c4043", border: "none", color: "white", borderRadius: "8px",
                        padding: "6px 12px", cursor: "pointer", fontSize: "12px", flex: 1
                    }}>🔇 Mute All</button>
                )}
                <button onClick={onToggleHand} style={{
                    background: handRaised ? "#f59e0b" : "#3c4043", border: "none", color: "white", borderRadius: "8px",
                    padding: "6px 12px", cursor: "pointer", fontSize: "12px", flex: 1,
                    transition: "background 0.2s"
                }}>
                    {handRaised ? "✋ Lower Hand" : "✋ Raise Hand"}
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {participants.map(p => (
                    <div key={p.userId} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: p.userId === currentUserId ? "#1a73e815" : "transparent",
                        borderRadius: "8px", padding: "8px 10px",
                        border: p.userId === currentUserId ? "1px solid #1a73e830" : "1px solid transparent"
                    }}>
                        {/* Avatar */}
                        <div style={{
                            width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                            background: `hsl(${p.userId.charCodeAt(0) * 20 % 360}, 60%, 45%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "14px", fontWeight: "bold", position: "relative"
                        }}>
                            {p.displayName.charAt(0).toUpperCase()}
                            {p.handRaised && (
                                <span style={{
                                    position: "absolute", top: "-6px", right: "-6px",
                                    fontSize: "14px", animation: "pulse 1s infinite"
                                }}>✋</span>
                            )}
                        </div>

                        {/* Name */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.displayName} {p.userId === currentUserId ? "(You)" : ""} {p.isHost ? "🎤" : ""}
                            </div>
                        </div>

                        {/* Status icons */}
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <span style={{ fontSize: "14px", opacity: p.isMuted ? 1 : 0.3 }} title={p.isMuted ? "Muted" : "Unmuted"}>
                                {p.isMuted ? "🔇" : "🎤"}
                            </span>
                            <span style={{ fontSize: "14px", opacity: p.isVideoOff ? 1 : 0.3 }} title={p.isVideoOff ? "Camera off" : "Camera on"}>
                                {p.isVideoOff ? "📵" : "📹"}
                            </span>
                        </div>

                        {/* Host controls */}
                        {isHost && p.userId !== currentUserId && (
                            <div style={{ display: "flex", gap: "4px" }}>
                                <button onClick={() => onMuteUser(p.userId)} title="Mute" style={{
                                    background: "none", border: "1px solid #3c4043", borderRadius: "4px",
                                    color: "#9ca3af", cursor: "pointer", padding: "2px 5px", fontSize: "11px"
                                }}>Mute</button>
                                <button onClick={() => onKickUser(p.userId)} title="Remove" style={{
                                    background: "none", border: "1px solid #ef4444", borderRadius: "4px",
                                    color: "#ef4444", cursor: "pointer", padding: "2px 5px", fontSize: "11px"
                                }}>✕</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
