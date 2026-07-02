"use client"

import React, { useState, useEffect, useRef } from "react"
import { TutorLog } from "@/hooks/useAITutorServer"

interface Props {
    isHost: boolean
    socket: any
    studentId: string
    studentName: string
    serverStatus?: boolean // Host only
    logs?: TutorLog[]     // Host only
}

interface ChatMessage {
    id: string
    sender: 'user' | 'ai'
    text: string
}

export default function AITutorPanel({ isHost, socket, studentId, studentName, serverStatus, logs }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: 'welcome', sender: 'ai', text: "Hello! I am your AI Teaching Assistant. How can I help you today?"
    }])
    const [input, setInput] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Listen for incoming AI streams (Student side)
    useEffect(() => {
        if (isHost || !socket) return

        const handleStream = (data: { msgId: string, chunk: string, done: boolean }) => {
            setIsTyping(!data.done)
            setMessages(prev => {
                const existing = prev.find(m => m.id === data.msgId)
                if (existing) {
                    return prev.map(m => m.id === data.msgId ? { ...m, text: m.text + data.chunk } : m)
                } else {
                    return [...prev, { id: data.msgId, sender: 'ai', text: data.chunk }]
                }
            })
        }

        socket.on("ai-stream", handleStream)
        return () => socket.off("ai-stream", handleStream)
    }, [socket, isHost])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isTyping, logs])

    const handleSend = () => {
        if (!input.trim() || !socket) return
        
        const msgId = Math.random().toString(36).substring(7)
        
        // Add to local UI
        setMessages(prev => [...prev, { id: msgId + "_user", sender: 'user', text: input }])
        
        // Send to Host
        socket.emit("ai-request", {
            msgId,
            studentId,
            studentName,
            prompt: input
        })

        setInput("")
        setIsTyping(true)
    }

    if (isHost) {
        return (
            <div style={{ padding: "16px", color: "white", display: "flex", flexDirection: "column", height: "100%" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>🧠 AI Tutor Server</span>
                    <span style={{ fontSize: '12px', background: serverStatus ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: serverStatus ? '#10b981' : '#ef4444', padding: '4px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: serverStatus ? '#10b981' : '#ef4444' }} />
                        {serverStatus ? "Ollama Connected" : "Ollama Offline"}
                    </span>
                </h3>
                
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
                    Your local laptop is acting as the AI server. All student questions are processed directly on your machine.
                </p>

                <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {logs?.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '12px', marginTop: '20px' }}>No student questions yet.</div>
                    ) : (
                        logs?.map(log => (
                            <div key={log.msgId} style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', borderLeft: log.status === 'error' ? '3px solid #ef4444' : log.status === 'processing' ? '3px solid #f59e0b' : '3px solid #10b981' }}>
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{log.studentName} asked:</span>
                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div style={{ fontSize: '13px', marginBottom: '8px' }}>&ldquo;{log.prompt}&rdquo;</div>
                                <div style={{ fontSize: '12px', color: log.status === 'error' ? '#ef4444' : '#d1d5db', fontStyle: log.status === 'processing' ? 'italic' : 'normal' }}>
                                    {log.status === 'processing' ? 'AI is typing...' : (log.response.substring(0, 100) + (log.response.length > 100 ? '...' : ''))}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        )
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "white", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🤖</span> AI Tutor
            </h3>
            
            {/* Chat History */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
                {messages.map(msg => (
                    <div key={msg.id} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                            {msg.sender === 'user' ? 'You' : 'AI Assistant'}
                        </div>
                        <div style={{ 
                            background: msg.sender === 'user' ? '#6366f1' : 'rgba(255,255,255,0.1)', 
                            color: 'white', 
                            padding: '10px 14px', 
                            borderRadius: '14px', 
                            borderBottomRightRadius: msg.sender === 'user' ? '4px' : '14px',
                            borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : '14px',
                            fontSize: '13px',
                            lineHeight: '1.4'
                        }}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '14px', color: '#9ca3af', fontSize: '13px' }}>
                        Typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                <input 
                    type="text" 
                    placeholder="Ask a question..." 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                    style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px", color: "white", fontSize: "13px", outline: "none" }}
                />
                <button 
                    onClick={handleSend}
                    disabled={!input.trim()}
                    style={{ background: input.trim() ? "#6366f1" : "rgba(255,255,255,0.1)", border: "none", color: "white", borderRadius: "8px", padding: "0 16px", cursor: input.trim() ? "pointer" : "not-allowed", transition: "background 0.2s" }}
                >
                    Send
                </button>
            </div>
        </div>
    )
}
