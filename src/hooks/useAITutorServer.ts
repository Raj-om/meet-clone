"use client"

import { useState, useEffect, useRef } from "react"

interface AIRequest {
    msgId: string
    studentId: string
    studentName: string
    prompt: string
}

export interface TutorLog {
    msgId: string
    timestamp: number
    studentName: string
    prompt: string
    status: 'processing' | 'completed' | 'error'
    response: string
}

export function useAITutorServer(socket: any, isHost: boolean) {
    const [isServerActive, setIsServerActive] = useState(false)
    const [logs, setLogs] = useState<TutorLog[]>([])
    const isHostRef = useRef(isHost)
    
    // We will use DeepSeek-R1-8B as it is the absolute best for complex math (GATE IIT)
    const OLLAMA_URL = "http://localhost:11434/api/generate"
    const MODEL_NAME = "deepseek-r1:8b"

    useEffect(() => {
        isHostRef.current = isHost
    }, [isHost])

    // Ping Ollama to check if it's running
    useEffect(() => {
        if (!isHost) return
        
        const checkOllama = async () => {
            try {
                const res = await fetch("http://localhost:11434/api/tags")
                if (res.ok) setIsServerActive(true)
            } catch (err) {
                setIsServerActive(false)
            }
        }
        checkOllama()
        const interval = setInterval(checkOllama, 10000)
        return () => clearInterval(interval)
    }, [isHost])

    useEffect(() => {
        if (!socket || !isHost) return

        const handleAIRequest = async (data: AIRequest) => {
            const { msgId, studentId, studentName, prompt } = data

            // 1. Log the incoming request for the Host's dashboard
            setLogs(prev => [{
                msgId, timestamp: Date.now(), studentName, prompt, status: 'processing', response: ''
            }, ...prev])

            try {
                // 2. Call local Ollama
                const response = await fetch(OLLAMA_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: MODEL_NAME,
                        prompt: `You are an expert AI teaching assistant in a live virtual classroom. The student named ${studentName} just asked: "${prompt}". Provide a helpful, clear, and concise explanation to clarify their doubt without completely giving away direct answers to exams.`,
                        stream: true
                    })
                })

                if (!response.ok || !response.body) {
                    throw new Error("Ollama connection failed")
                }

                // 3. Read the stream and emit chunks back to the specific student
                const reader = response.body.getReader()
                const decoder = new TextDecoder("utf-8")
                let fullResponse = ""

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value, { stream: true })
                    // Ollama streams JSON lines
                    const lines = chunk.split("\n").filter(l => l.trim() !== "")
                    
                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line)
                            if (parsed.response) {
                                fullResponse += parsed.response
                                // Emit chunk to the student via WebRTC/Socket
                                socket.emit("ai-stream", {
                                    studentId,
                                    msgId,
                                    chunk: parsed.response,
                                    done: false
                                })
                            }
                        } catch (e) {
                            // ignore parse error for incomplete chunks
                        }
                    }
                }

                // Finish
                socket.emit("ai-stream", {
                    studentId,
                    msgId,
                    chunk: "",
                    done: true
                })

                setLogs(prev => prev.map(log => log.msgId === msgId ? { ...log, status: 'completed', response: fullResponse } : log))

            } catch (error) {
                console.error("Ollama Error:", error)
                socket.emit("ai-stream", {
                    studentId,
                    msgId,
                    chunk: "\n\n*[System: The AI Tutor is currently offline or unreachable]*",
                    done: true
                })
                setLogs(prev => prev.map(log => log.msgId === msgId ? { ...log, status: 'error' } : log))
            }
        }

        socket.on("ai-request", handleAIRequest)
        return () => {
            socket.off("ai-request", handleAIRequest)
        }
    }, [socket, isHost])

    return {
        isServerActive,
        logs
    }
}
