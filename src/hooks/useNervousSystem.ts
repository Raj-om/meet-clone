"use client"

import { useEffect, useCallback } from "react"

// Define all possible events our Nervous System can handle
export type NervousSystemEvent = 
    | "AI:MODEL_LOADED"
    | "AI:CRASHED"
    | "USER:LOOKING_AWAY"
    | "USER:ATTENTION_RESTORED"
    | "USER:STRESSED"
    | "SYSTEM:NETWORK_DEGRADED"

// Type-safe payload mapping
export interface NervousSystemPayloads {
    "AI:MODEL_LOADED": { modelName: string }
    "AI:CRASHED": { modelName: string, error: string }
    "USER:LOOKING_AWAY": { duration: number, direction: string }
    "USER:ATTENTION_RESTORED": { durationAway: number }
    "USER:STRESSED": { score: number }
    "SYSTEM:NETWORK_DEGRADED": { ping: number }
}

// A lightweight singleton Event Bus
class EventBus {
    private target = new EventTarget()

    emit<K extends NervousSystemEvent>(event: K, detail?: NervousSystemPayloads[K]) {
        this.target.dispatchEvent(new CustomEvent(event, { detail }))
    }

    on<K extends NervousSystemEvent>(
        event: K, 
        callback: (detail: NervousSystemPayloads[K]) => void
    ) {
        const handler = (e: Event) => callback((e as CustomEvent).detail)
        this.target.addEventListener(event, handler)
        return () => this.target.removeEventListener(event, handler) // return cleanup
    }
}

// Create the singleton instance
const nervousSystemCore = new EventBus()

/**
 * The Nervous System Hook
 * Allows components to broadcast and listen to app-wide events without
 * drilling props or causing massive React re-renders.
 */
export function useNervousSystem() {
    
    const broadcast = useCallback(<K extends NervousSystemEvent>(
        event: K, 
        payload?: NervousSystemPayloads[K]
    ) => {
        nervousSystemCore.emit(event, payload)
        console.log(`🧠 [Nervous System] Signal broadcast: ${event}`, payload || "")
    }, [])

    const useListen = <K extends NervousSystemEvent>(
        event: K, 
        callback: (payload: NervousSystemPayloads[K]) => void,
        dependencies: any[] = []
    ) => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const memoizedCallback = useCallback(callback, dependencies)
        
        useEffect(() => {
            const cleanup = nervousSystemCore.on(event, memoizedCallback)
            return cleanup
        }, [event, memoizedCallback])
    }

    return {
        broadcast,
        useListen
    }
}
