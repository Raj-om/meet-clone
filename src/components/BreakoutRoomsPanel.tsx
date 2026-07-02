"use client"

import { useState, useEffect } from "react"
import { Socket } from "socket.io-client"

interface BreakoutRoom {
    id: string
    name: string
    participants: string[]
}

interface Props {
    socket: Socket | null
    userId: string
    isHost: boolean
    participants: { userId: string; displayName: string }[]
    mainRoomId: string
}

export default function BreakoutRoomsPanel({ socket, userId, isHost, participants, mainRoomId }: Props) {
    const [rooms, setRooms] = useState<BreakoutRoom[]>([])
    const [active, setActive] = useState(false)
    const [myRoom, setMyRoom] = useState<string | null>(null)
    const [numRooms, setNumRooms] = useState(2)
    const [timer, setTimer] = useState<number>(0)
    const [timeLeft, setTimeLeft] = useState<number>(0)

    useEffect(() => {
        if (!socket) return
        const onStarted = (r: BreakoutRoom[]) => { setRooms(r); setActive(true) }
        const onEnded = () => { setRooms([]); setActive(false); setMyRoom(null) }
        socket.on("breakout-started", onStarted)
        socket.on("breakout-ended", onEnded)
        return () => { socket.off("breakout-started", onStarted); socket.off("breakout-ended", onEnded) }
    }, [socket])

    // Timer countdown
    useEffect(() => {
        if (!active || timer === 0) return
        setTimeLeft(timer * 60)
        const interval = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) { clearInterval(interval); socket?.emit("end-breakout"); return 0 }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [active, timer, socket])

    const createRooms = () => {
        // Auto-distribute participants evenly
        const shuffled = [...participants].sort(() => Math.random() - 0.5)
        const created: BreakoutRoom[] = Array.from({ length: numRooms }, (_, i) => ({
            id: `${mainRoomId}-breakout-${i}`,
            name: `Room ${i + 1}`,
            participants: []
        }))
        shuffled.forEach((p, i) => created[i % numRooms].participants.push(p.userId))
        socket?.emit("create-breakout", { rooms: created })
        setRooms(created); setActive(true)
    }

    const joinRoom = (roomId: string) => {
        socket?.emit("join-breakout", { breakoutRoomId: roomId })
        setMyRoom(roomId)
    }

    const endBreakout = () => {
        socket?.emit("end-breakout")
        setRooms([]); setActive(false); setMyRoom(null)
    }

    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

    return (
        <div style={{ color: "white", display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>🔵 Breakout Rooms</span>
                {active && timer > 0 && (
                    <span style={{ background: "#1a73e815", border: "1px solid #1a73e840", borderRadius: "20px", padding: "3px 10px", color: "#8ab4f8", fontSize: "12px" }}>
                        ⏱ {fmtTime(timeLeft)}
                    </span>
                )}
            </div>

            {!active && isHost && (
                <div style={{ background: "#3c4043", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                        <label style={{ color: "#9ca3af", fontSize: "11px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Number of Rooms</label>
                        <div style={{ display: "flex", gap: "6px" }}>
                            {[2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => setNumRooms(n)} style={{
                                    flex: 1, padding: "6px", borderRadius: "6px", cursor: "pointer",
                                    background: numRooms === n ? "#1a73e8" : "#202124",
                                    border: "none", color: "white", fontSize: "13px", fontWeight: numRooms === n ? 700 : 400
                                }}>{n}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={{ color: "#9ca3af", fontSize: "11px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Timer (minutes, 0 = unlimited)</label>
                        <input type="number" min={0} max={60} value={timer} onChange={e => setTimer(Number(e.target.value))}
                            style={{ width: "100%", background: "#202124", border: "1px solid #5f6368", borderRadius: "6px", color: "white", padding: "7px 10px", fontSize: "13px", outline: "none" }} />
                    </div>
                    <button onClick={createRooms} style={{
                        background: "#1a73e8", border: "none", color: "white", borderRadius: "8px",
                        padding: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700
                    }}>
                        Open Rooms
                    </button>
                </div>
            )}

            {active && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {rooms.map(room => {
                        const isMine = myRoom === room.id
                        const roomParticipants = participants.filter(p => room.participants.includes(p.userId))
                        return (
                            <div key={room.id} style={{
                                background: isMine ? "#1a73e815" : "#3c4043",
                                border: isMine ? "1px solid #1a73e840" : "1px solid transparent",
                                borderRadius: "10px", padding: "12px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                    <span style={{ fontWeight: 600, fontSize: "13px" }}>{room.name}</span>
                                    {isMine
                                        ? <span style={{ color: "#8ab4f8", fontSize: "11px" }}>✓ You&apos;re here</span>
                                        : <button onClick={() => joinRoom(room.id)} style={{
                                            background: "#1a73e8", border: "none", color: "white", borderRadius: "6px",
                                            padding: "4px 10px", cursor: "pointer", fontSize: "11px", fontWeight: 600
                                        }}>Join</button>
                                    }
                                </div>
                                {roomParticipants.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                        {roomParticipants.map(p => (
                                            <span key={p.userId} style={{ background: "#202124", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#9ca3af" }}>
                                                {p.displayName}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {isHost && (
                        <button onClick={endBreakout} style={{
                            background: "#ef444420", border: "1px solid #ef444440", color: "#ef4444",
                            borderRadius: "8px", padding: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, marginTop: "4px"
                        }}>
                            End Breakout Sessions
                        </button>
                    )}
                </div>
            )}

            {!active && !isHost && (
                <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "30px" }}>
                    Waiting for host to open breakout rooms…
                </div>
            )}
        </div>
    )
}
