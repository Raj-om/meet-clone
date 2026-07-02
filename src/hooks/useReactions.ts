"use client"

import { useEffect, useState, useCallback } from "react"
import { Socket } from "socket.io-client"

export interface Reaction {
    id: string
    emoji: string
    senderId: string
    senderName: string
    timestamp: number
}

export const useReactions = (socket: Socket | null, userId: string, displayName: string) => {
    const [reactions, setReactions] = useState<Reaction[]>([])

    useEffect(() => {
        if (!socket) return
        const onReaction = (reaction: Reaction) => {
            setReactions(prev => [...prev, reaction])
            // Auto-remove after 4 seconds
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reaction.id))
            }, 4000)
        }
        socket.on("reaction", onReaction)
        return () => { socket.off("reaction", onReaction) }
    }, [socket])

    const sendReaction = useCallback((emoji: string) => {
        if (!socket) return
        const reaction: Reaction = {
            id: Math.random().toString(36).substring(2),
            emoji,
            senderId: userId,
            senderName: displayName,
            timestamp: Date.now()
        }
        socket.emit("reaction", reaction)
        // Also show locally
        setReactions(prev => [...prev, reaction])
        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== reaction.id))
        }, 4000)
    }, [socket, userId, displayName])

    return { reactions, sendReaction }
}
