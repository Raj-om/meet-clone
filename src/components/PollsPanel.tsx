"use client"

import { useState, useEffect } from "react"
import { Socket } from "socket.io-client"

interface PollOption {
    text: string
    votes: string[] // array of voterIds
}

interface Poll {
    id: string
    question: string
    options: PollOption[]
    createdBy: string
    closed: boolean
}

interface QAQuestion {
    id: string
    text: string
    askedBy: string
    askerName: string
    pinned: boolean
}

interface Props {
    socket: Socket | null
    userId: string
    displayName: string
    isHost: boolean
}

export default function PollsPanel({ socket, userId, displayName, isHost }: Props) {
    const [polls, setPolls] = useState<Poll[]>([])
    const [questions, setQuestions] = useState<QAQuestion[]>([])
    const [activeView, setActiveView] = useState<"polls" | "qa">("polls")
    const [newQuestion, setNewQuestion] = useState("")
    const [newPollQ, setNewPollQ] = useState("")
    const [newPollOptions, setNewPollOptions] = useState(["", ""])
    const [showCreatePoll, setShowCreatePoll] = useState(false)

    useEffect(() => {
        if (!socket) return

        const onPollCreated = (poll: Poll) => setPolls(prev => [...prev, poll])
        const onPollVote = ({ pollId, optionIndex, voterId }: { pollId: string; optionIndex: number; voterId: string }) => {
            setPolls(prev => prev.map(p => {
                if (p.id !== pollId) return p
                const updated = {
                    ...p, options: p.options.map((opt, i) => {
                        if (i !== optionIndex) return opt
                        if (opt.votes.includes(voterId)) return opt
                        return { ...opt, votes: [...opt.votes, voterId] }
                    })
                }
                return updated
            }))
        }
        const onQaQuestion = (q: QAQuestion) => setQuestions(prev => [...prev, q])

        socket.on("poll-created", onPollCreated)
        socket.on("poll-vote", onPollVote)
        socket.on("qa-question", onQaQuestion)
        return () => {
            socket.off("poll-created", onPollCreated)
            socket.off("poll-vote", onPollVote)
            socket.off("qa-question", onQaQuestion)
        }
    }, [socket])

    const createPoll = () => {
        if (!newPollQ.trim() || newPollOptions.filter(o => o.trim()).length < 2) return
        const poll: Poll = {
            id: Math.random().toString(36).slice(2),
            question: newPollQ.trim(),
            options: newPollOptions.filter(o => o.trim()).map(text => ({ text, votes: [] })),
            createdBy: userId,
            closed: false
        }
        socket?.emit("create-poll", poll)
        setPolls(prev => [...prev, poll])
        setNewPollQ(""); setNewPollOptions(["", ""]); setShowCreatePoll(false)
    }

    const vote = (pollId: string, optionIndex: number) => {
        socket?.emit("poll-vote", { pollId, optionIndex })
        setPolls(prev => prev.map(p => {
            if (p.id !== pollId) return p
            const alreadyVoted = p.options.some(o => o.votes.includes(userId))
            if (alreadyVoted) return p
            return {
                ...p, options: p.options.map((opt, i) =>
                    i === optionIndex ? { ...opt, votes: [...opt.votes, userId] } : opt
                )
            }
        }))
    }

    const submitQuestion = () => {
        if (!newQuestion.trim()) return
        const q: QAQuestion = {
            id: Math.random().toString(36).slice(2),
            text: newQuestion.trim(),
            askedBy: userId,
            askerName: displayName,
            pinned: false
        }
        socket?.emit("qa-question", q)
        setQuestions(prev => [...prev, q])
        setNewQuestion("")
    }

    const s: React.CSSProperties = {
        background: "none", border: "none", color: "white", cursor: "pointer",
        fontSize: "12px", padding: "4px 10px", borderRadius: "6px"
    }

    return (
        <div style={{ color: "white", display: "flex", flexDirection: "column", height: "100%" }}>
            {/* View toggle */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                {(["polls", "qa"] as const).map(v => (
                    <button key={v} onClick={() => setActiveView(v)} style={{
                        flex: 1, padding: "7px", borderRadius: "8px", cursor: "pointer", border: "none",
                        background: activeView === v ? "#1a73e8" : "#3c4043",
                        color: "white", fontSize: "13px", fontWeight: activeView === v ? 600 : 400,
                        transition: "background 0.2s"
                    }}>
                        {v === "polls" ? "📊 Polls" : "❓ Q&A"}
                    </button>
                ))}
            </div>

            {activeView === "polls" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {isHost && (
                        <button onClick={() => setShowCreatePoll(v => !v)} style={{
                            background: "#1a73e8", border: "none", color: "white", borderRadius: "8px",
                            padding: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600
                        }}>
                            {showCreatePoll ? "✕ Cancel" : "+ Create Poll"}
                        </button>
                    )}

                    {showCreatePoll && (
                        <div style={{ background: "#3c4043", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <input value={newPollQ} onChange={e => setNewPollQ(e.target.value)}
                                placeholder="Poll question…"
                                style={{ background: "#202124", border: "1px solid #5f6368", borderRadius: "6px", color: "white", padding: "7px 10px", fontSize: "13px", outline: "none" }} />
                            {newPollOptions.map((opt, i) => (
                                <input key={i} value={opt} onChange={e => setNewPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                                    placeholder={`Option ${i + 1}`}
                                    style={{ background: "#202124", border: "1px solid #5f6368", borderRadius: "6px", color: "white", padding: "7px 10px", fontSize: "13px", outline: "none" }} />
                            ))}
                            <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => setNewPollOptions(p => [...p, ""])} style={{ ...s, background: "#5f6368", flex: 1 }}>+ Option</button>
                                <button onClick={createPoll} style={{ ...s, background: "#1a73e8", flex: 2, fontWeight: 600 }}>Launch Poll</button>
                            </div>
                        </div>
                    )}

                    {polls.length === 0 && !showCreatePoll && (
                        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "30px" }}>
                            No active polls yet.{isHost ? " Create one!" : ""}
                        </div>
                    )}

                    {polls.map(poll => {
                        const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0)
                        const myVote = poll.options.findIndex(o => o.votes.includes(userId))
                        return (
                            <div key={poll.id} style={{ background: "#3c4043", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{poll.question}</div>
                                {poll.options.map((opt, i) => {
                                    const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0
                                    const voted = myVote >= 0
                                    return (
                                        <div key={i} style={{ marginBottom: "6px" }}>
                                            <button
                                                onClick={() => !voted && vote(poll.id, i)}
                                                disabled={voted}
                                                style={{
                                                    width: "100%", padding: "7px 10px", borderRadius: "6px", cursor: voted ? "default" : "pointer",
                                                    border: myVote === i ? "1px solid #1a73e8" : "1px solid #5f6368",
                                                    background: "transparent", color: "white", textAlign: "left",
                                                    display: "flex", alignItems: "center", gap: "8px", fontSize: "12px",
                                                    position: "relative", overflow: "hidden"
                                                }}
                                            >
                                                {voted && (
                                                    <div style={{
                                                        position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`,
                                                        background: myVote === i ? "rgba(26,115,232,0.25)" : "rgba(255,255,255,0.08)",
                                                        transition: "width 0.5s ease"
                                                    }} />
                                                )}
                                                <span style={{ position: "relative", flex: 1 }}>{opt.text}</span>
                                                {voted && <span style={{ position: "relative", color: "#9ca3af", fontSize: "11px" }}>{pct}%</span>}
                                                {myVote === i && <span style={{ position: "relative", color: "#1a73e8" }}>✓</span>}
                                            </button>
                                        </div>
                                    )
                                })}
                                <div style={{ color: "#9ca3af", fontSize: "11px", marginTop: "6px" }}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</div>
                            </div>
                        )
                    })}
                </div>
            )}

            {activeView === "qa" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
                    {questions.length === 0 && (
                        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "30px" }}>No questions yet.</div>
                    )}
                    {questions.map(q => (
                        <div key={q.id} style={{
                            background: q.pinned ? "#1a73e815" : "#3c4043",
                            border: q.pinned ? "1px solid #1a73e840" : "1px solid transparent",
                            borderRadius: "8px", padding: "10px 12px"
                        }}>
                            {q.pinned && <div style={{ color: "#8ab4f8", fontSize: "10px", marginBottom: "3px" }}>📌 Pinned</div>}
                            <div style={{ fontSize: "13px" }}>{q.text}</div>
                            <div style={{ color: "#9ca3af", fontSize: "11px", marginTop: "4px" }}>— {q.askerName}</div>
                        </div>
                    ))}

                    <div style={{ display: "flex", gap: "6px", marginTop: "auto", paddingTop: "8px" }}>
                        <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && submitQuestion()}
                            placeholder="Ask a question…"
                            style={{ flex: 1, background: "#3c4043", border: "1px solid #5f6368", borderRadius: "8px", color: "white", padding: "8px 12px", fontSize: "13px", outline: "none" }}
                        />
                        <button onClick={submitQuestion} style={{ background: "#1a73e8", border: "none", borderRadius: "8px", color: "white", padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}>Ask</button>
                    </div>
                </div>
            )}
        </div>
    )
}
