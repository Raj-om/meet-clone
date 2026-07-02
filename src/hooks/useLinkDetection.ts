"use client"

import { useState, useCallback } from "react"
import { ScamSignal } from "./useScamDetection"

export interface SuspiciousLink {
    url: string
    threatType: "MALWARE" | "SOCIAL_ENGINEERING" | "UNWANTED_SOFTWARE" | "POTENTIALLY_HARMFUL_APPLICATION" | "SUSPICIOUS_HEURISTIC" | "SAFE"
    riskScore: number
    timestamp: number
}

interface UseLinkDetectionOptions {
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
}

// Simple heuristic for generic phishing domains
const SUSPICIOUS_DOMAINS = [
    "bit.ly", "tinyurl.com", "t.co", "is.gd", "goo.gl", "click", "free", "win", "gift"
]

export function useLinkDetection({ enabled, updateScore }: UseLinkDetectionOptions) {
    const [flaggedLinks, setFlaggedLinks] = useState<SuspiciousLink[]>([])

    const extractUrls = (text: string): string[] => {
        const urlRegex = /(https?:\/\/[^\s]+)/g
        return text.match(urlRegex) || []
    }

    function checkHeuristic(url: string, strict = false): SuspiciousLink["threatType"] {
        try {
            const parsed = new URL(url)
            const isSuspicious = SUSPICIOUS_DOMAINS.some(domain => parsed.hostname.includes(domain))

            // Lookalikes: rnicrosoft.com, paypa1.com, netfIix.com
            const lookalikeRegex = /(rnicrosoft|paypa[1il]|netf[1il]ix|faceb00k|appl[e3]support|update.*windows)/i
            const isLookalike = lookalikeRegex.test(parsed.hostname) || lookalikeRegex.test(parsed.pathname)

            if (isSuspicious || isLookalike) return "SUSPICIOUS_HEURISTIC"

            if (!strict && parsed.protocol !== "https:") return "SUSPICIOUS_HEURISTIC" // Unsecured HTTP is a heuristic flag

            return "SAFE"
        } catch {
            return "SUSPICIOUS_HEURISTIC" // Malformed URL
        }
    }

    const checkSafeBrowsingAPI = async (url: string): Promise<SuspiciousLink["threatType"]> => {
        // NOTE: In a real production app, this should be routed through a backend proxy
        // to protect the API key. For this demo, we'll simulate the Google Safe Browsing check,
        // but we will also use a heuristic approach for demonstration.

        try {
            const GOOGLE_SAFE_BROWSING_API_KEY = process.env.NEXT_PUBLIC_SAFE_BROWSING_KEY;

            if (!GOOGLE_SAFE_BROWSING_API_KEY) {
                console.warn("[useLinkDetection] No Safe Browsing API key found. Falling back to heuristic scan.")
                return checkHeuristic(url)
            }

            const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client: { clientId: "meet-clone", clientVersion: "1.0.0" },
                    threatInfo: {
                        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                        platformTypes: ["ANY_PLATFORM"],
                        threatEntryTypes: ["URL"],
                        threatEntries: [{ url }]
                    }
                })
            })

            const data = await res.json()
            if (data && data.matches && data.matches.length > 0) {
                return data.matches[0].threatType as SuspiciousLink["threatType"]
            }

            // If Safe Browsing says it's clean, still run our local heuristic for extra safety against 0-days
            return checkHeuristic(url, true)
        } catch (error) {
            console.error("[useLinkDetection] Safe browsing API error:", error)
            return checkHeuristic(url)
        }
    }

    const scanMessage = useCallback(async (message: string) => {
        if (!enabled) return

        const urls = extractUrls(message)
        if (urls.length === 0) return

        for (const url of urls) {
            const threatType = await checkSafeBrowsingAPI(url)

            if (threatType !== "SAFE") {
                const threatScore = threatType === "SUSPICIOUS_HEURISTIC" ? 40 : 100

                const newLink: SuspiciousLink = {
                    url,
                    threatType,
                    riskScore: threatScore,
                    timestamp: Date.now()
                }

                setFlaggedLinks(prev => [newLink, ...prev].slice(0, 5)) // Keep last 5

                updateScore("behavioral", threatScore) // Mapping bad links to a behavioral flag
            }
        }
    }, [enabled, updateScore])

    const clearLinks = useCallback(() => {
        setFlaggedLinks([])
    }, [])

    return { flaggedLinks, scanMessage, clearLinks }
}
