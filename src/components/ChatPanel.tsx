"use client"

import { useEffect, useRef, useState } from "react"
import { ChatMessage } from "@/hooks/useChat"

interface Props {
    messages: ChatMessage[]
    currentUserId: string
    onSend: (text: string) => void
    onSendImage: (data: string) => void
    onOpen: () => void
    onClose: () => void
}

const EMOJI_LIST = ["😀", "😂", "😍", "😮", "👍", "❤️", "🔥", "🎉", "😢", "😡", "🤔", "👏"]

export default function ChatPanel({ messages, currentUserId, onSend, onSendImage, onOpen, onClose }: Props) {
    const [input, setInput] = useState("")
    const [showEmoji, setShowEmoji] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => { onOpen() }, [onOpen])
    useEffect(() => () => { onClose() }, [onClose])
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

    const send = () => {
        if (input.trim()) { onSend(input); setInput("") }
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => onSendImage(reader.result as string)
        reader.readAsDataURL(file)
        e.target.value = ""
    }

    const fmt = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "white" }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "40px" }}>
                        No messages yet. Say hello! 👋
                    </div>
                )}
                {messages.map(msg => {
                    const isMe = msg.senderId === currentUserId
                    return (
                        <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                            {!isMe && (
                                <span style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "2px", paddingLeft: "4px" }}>
                                    {msg.senderName}
                                </span>
                            )}
                            <div style={{
                                maxWidth: "85%",
                                background: isMe ? "#1a73e8" : "#3c4043",
                                borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                                padding: msg.type === "image" ? "4px" : "8px 12px",
                                fontSize: "14px",
                                wordBreak: "break-word",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                            }}>
                                {msg.type === "image" && msg.imageData
                                    ? <img src={msg.imageData} alt="shared" style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "12px", display: "block" }} />
                                    : msg.text
                                }
                            </div>
                            <span style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px", paddingLeft: "4px", paddingRight: "4px" }}>
                                {fmt(msg.timestamp)}
                            </span>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* Emoji picker */}
            {showEmoji && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "8px", background: "#2d2f33", borderTop: "1px solid #3c4043" }}>
                    {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => setInput(p => p + e)} style={{
                            background: "none", border: "none", fontSize: "20px", cursor: "pointer", padding: "2px 4px",
                            borderRadius: "4px", transition: "background 0.15s"
                        }} onMouseEnter={ev => (ev.currentTarget.style.background = "#3c4043")}
                            onMouseLeave={ev => (ev.currentTarget.style.background = "none")}
                        >{e}</button>
                    ))}
                </div>
            )}

            {/* Input row */}
            <div style={{ display: "flex", gap: "6px", padding: "10px 8px", borderTop: "1px solid #3c4043", alignItems: "center" }}>
                <button
                    onClick={() => setShowEmoji(v => !v)}
                    title="Emoji"
                    style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", padding: "4px", borderRadius: "50%", color: "white", flexShrink: 0 }}
                >😊</button>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && send()}
                    placeholder="Send a message…"
                    style={{
                        flex: 1, background: "#3c4043", border: "none", borderRadius: "20px",
                        padding: "8px 14px", color: "white", fontSize: "14px", outline: "none"
                    }}
                />
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} title="Send image" style={{
                    background: "none", border: "none", cursor: "pointer", padding: "4px", flexShrink: 0,
                    color: "#9ca3af", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </button>
                <button onClick={send} disabled={!input.trim()} title="Send" style={{
                    background: input.trim() ? "#1a73e8" : "#3c4043", border: "none", borderRadius: "50%",
                    width: "36px", height: "36px", cursor: input.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "background 0.2s"
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
