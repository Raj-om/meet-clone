"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Socket } from "socket.io-client"

export interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    text: string
    timestamp: number
    type?: "text" | "image"
    imageData?: string
}

export const useChat = (socket: Socket | null, userId: string, displayName: string) => {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const isChatOpen = useRef(false)

    useEffect(() => {
        if (!socket) return

        const onMessage = (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg])
            if (!isChatOpen.current) {
                setUnreadCount(c => c + 1)
            }
        }

        socket.on("chat-message", onMessage)
        return () => { socket.off("chat-message", onMessage) }
    }, [socket])

    const sendMessage = useCallback((text: string) => {
        if (!socket || !text.trim()) return
        const msg: ChatMessage = {
            id: Math.random().toString(36).substring(2),
            senderId: userId,
            senderName: displayName,
            text: text.trim(),
            timestamp: Date.now(),
            type: "text"
        }
        socket.emit("chat-message", msg)
        // Optimistically add own message
        setMessages(prev => [...prev, msg])
    }, [socket, userId, displayName])

    const sendImage = useCallback((imageData: string) => {
        if (!socket) return
        const msg: ChatMessage = {
            id: Math.random().toString(36).substring(2),
            senderId: userId,
            senderName: displayName,
            text: "",
            timestamp: Date.now(),
            type: "image",
            imageData
        }
        socket.emit("chat-message", msg)
        setMessages(prev => [...prev, msg])
    }, [socket, userId, displayName])

    const markRead = useCallback(() => {
        isChatOpen.current = true
        setUnreadCount(0)
    }, [])

    const markClosed = useCallback(() => {
        isChatOpen.current = false
    }, [])

    return { messages, unreadCount, sendMessage, sendImage, markRead, markClosed }
}
