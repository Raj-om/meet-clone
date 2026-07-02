// Transformers.js Sentiment Analysis — Web Worker
// This file runs in a SEPARATE Web Worker thread so inference never blocks the UI.
// The main thread posts messages to this worker and receives results back.

import { pipeline, env } from "@huggingface/transformers"

// Use WebGPU if the browser supports it, otherwise fall back to WASM
env.allowLocalModels = false
env.useBrowserCache = true  // Cache model after first download

// Lightweight quantized DistilBERT — ~67MB, runs fast on WebGPU
const MODEL_ID = "Xenova/distilbert-base-uncased-finetuned-sst-2-english"

let sentimentPipeline: Awaited<ReturnType<typeof pipeline>> | null = null
let loading = false

async function getSentimentPipeline() {
    if (sentimentPipeline) return sentimentPipeline
    if (loading) {
        while (!sentimentPipeline) await new Promise(r => setTimeout(r, 100))
        return sentimentPipeline
    }
    loading = true
    try {
        // Try WebGPU first, fall back to WASM
        sentimentPipeline = await pipeline("sentiment-analysis", MODEL_ID, {
            device: "webgpu",
            dtype: "q4",  // 4-bit quantized for minimum memory footprint
        })
    } catch {
        // WebGPU not available — use WASM
        sentimentPipeline = await pipeline("sentiment-analysis", MODEL_ID, {
            dtype: "q8",
        })
    }
    loading = false
    return sentimentPipeline
}

// Stress/scam keywords to flag regardless of sentiment model
const STRESS_KEYWORDS = [
    "transfer", "urgent", "immediately", "account", "verify", "password",
    "otp", "pin", "bank", "police", "arrested", "government", "irs", "tax",
    "deadline", "lawsuit", "frozen", "blocked", "hacked", "victim",
    "compensate", "refund", "pay", "wire", "bitcoin", "gift card",
]

self.onmessage = async (e: MessageEvent) => {
    const { type, text, id } = e.data

    if (type === "INIT") {
        self.postMessage({ type: "STATUS", status: "loading" })
        try {
            await getSentimentPipeline()
            self.postMessage({ type: "STATUS", status: "ready" })
        } catch (err) {
            self.postMessage({ type: "STATUS", status: "error", error: String(err) })
        }
        return
    }

    if (type === "ANALYZE") {
        try {
            const pipe = await getSentimentPipeline()
            if (!pipe) {
                self.postMessage({ type: "RESULT", id, error: "Model not loaded" })
                return
            }

            // Run sentiment analysis
            const result = (await (pipe as (text: string, opts: unknown) => Promise<Array<{ label: string; score: number }>>)(text, { topk: 2 }))
            const negativeScore = result.find(r => r.label === "NEGATIVE")?.score ?? 0

            // Keyword scan
            const lower = text.toLowerCase()
            const foundKeywords = STRESS_KEYWORDS.filter(kw => lower.includes(kw))
            const keywordScore = Math.min(1, foundKeywords.length * 0.3)

            // Composite: 60% model sentiment + 40% keyword match
            const compositeScore = Math.min(1, negativeScore * 0.6 + keywordScore * 0.4)

            self.postMessage({
                type: "RESULT",
                id,
                negativeScore,
                keywordScore,
                compositeScore,
                foundKeywords,
                label: compositeScore > 0.75 ? "HIGH_RISK" : compositeScore > 0.45 ? "SUSPICIOUS" : "SAFE",
            })
        } catch (err) {
            self.postMessage({ type: "RESULT", id, error: String(err) })
        }
    }
}

export {}
