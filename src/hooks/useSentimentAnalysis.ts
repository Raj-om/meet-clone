"use client"

import { useEffect, useRef, useCallback, useState } from "react"

export interface SentimentResult {
    text: string
    label: "HIGH_RISK" | "SUSPICIOUS" | "SAFE"
    compositeScore: number       // 0-1
    emotions: {
        joy: number;
        anger: number;
        sadness: number;
        fear: number;
        surprise: number;
        disgust: number;
    }
    semanticFraudIntent: number // 0-1
    foundKeywords: string[]
    timestamp: number
}

interface UseSentimentAnalysisOptions {
    enabled: boolean
    onResult?: (result: SentimentResult) => void
}

export interface SentimentAnalysisHook {
    analyzeText: (text: string) => void
    results: SentimentResult[]
    workerStatus: "idle" | "loading" | "ready" | "error"
    latestResult: SentimentResult | null
}

export function useSentimentAnalysis({
    enabled, onResult
}: UseSentimentAnalysisOptions): SentimentAnalysisHook {
    const [results, setResults] = useState<SentimentResult[]>([])
    const [workerStatus, setWorkerStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
    const [latestResult, setLatestResult] = useState<SentimentResult | null>(null)

    const workerRef = useRef<Worker | null>(null)
    const pendingRef = useRef<Map<number, string>>(new Map())
    const idRef = useRef(0)

    // Initialize the Web Worker
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return

        setWorkerStatus("loading")

        // Inline worker using Blob — avoids Next.js bundling issues with workers
        // The worker loads Transformers.js and processes messages
        const workerCode = `
            let pipeline = null;
            let loading = false;

            const STRESS_KEYWORDS = [
                "transfer","urgent","immediately","account","verify","password",
                "otp","pin","bank","police","arrested","government","irs","tax",
                "deadline","lawsuit","frozen","blocked","hacked","victim",
                "compensate","refund","pay","wire","bitcoin","gift card"
            ];

            // Scam intent prototype vectors for semantic matching
            const SCAM_INTENT_PHRASES = [
                "send the money to my account",
                "your account will be locked if you don't act now",
                "we need to verify your credentials immediately",
                "this is a federal agent you must comply",
                "provide your social security number"
            ];

            let emotionPipe = null;
            let embeddingPipe = null;
            let scamEmbeddings = null;

            async function getPipelines() {
                if (emotionPipe && embeddingPipe) return { emotionPipe, embeddingPipe };
                if (loading) { while (!(emotionPipe && embeddingPipe)) await new Promise(r => setTimeout(r, 100)); return { emotionPipe, embeddingPipe }; }
                loading = true;
                try {
                    const { pipeline: createPipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js');
                    env.allowLocalModels = false;
                    env.useBrowserCache = true;
                    
                    try {
                        emotionPipe = await createPipeline('text-classification', 
                            'Xenova/distilroberta-base-emotion',
                            { device: 'webgpu', dtype: 'q4' }
                        );
                    } catch {
                        emotionPipe = await createPipeline('text-classification',
                            'Xenova/distilroberta-base-emotion',
                            { dtype: 'q8' }
                        );
                    }

                    try {
                        embeddingPipe = await createPipeline('feature-extraction',
                            'Xenova/all-MiniLM-L6-v2',
                            { device: 'webgpu', dtype: 'q4' }
                        );
                    } catch {
                        embeddingPipe = await createPipeline('feature-extraction',
                            'Xenova/all-MiniLM-L6-v2',
                            { dtype: 'q8' }
                        );
                    }

                    const scamOutput = await embeddingPipe(SCAM_INTENT_PHRASES, { pooling: 'mean', normalize: true });
                    scamEmbeddings = scamOutput.tolist();

                } finally { loading = false; }
                return { emotionPipe, embeddingPipe };
            }

            self.onmessage = async (e) => {
                const { type, text, id } = e.data;
                if (type === 'INIT') {
                    self.postMessage({ type: 'STATUS', status: 'loading' });
                    try { await getPipelines(); self.postMessage({ type: 'STATUS', status: 'ready' }); }
                    catch (err) { self.postMessage({ type: 'STATUS', status: 'error', error: String(err) }); }
                    return;
                }
                if (type === 'ANALYZE') {
                    try {
                        const { emotionPipe, embeddingPipe } = await getPipelines();
                        const { cos_sim } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js');
                        
                        const emotionResults = await emotionPipe(text, { topk: 6 });
                        const emotions = { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, disgust: 0 };
                        emotionResults.forEach(r => {
                            if (r.label in emotions) emotions[r.label as keyof typeof emotions] = r.score;
                        });

                        const textOutput = await embeddingPipe(text, { pooling: 'mean', normalize: true });
                        const textEmbedding = textOutput.tolist()[0];
                        
                        let maxSimilarity = 0;
                        for (const scamVec of scamEmbeddings) {
                            const sim = cos_sim(textEmbedding, scamVec);
                            if (sim > maxSimilarity) maxSimilarity = sim;
                        }

                        const lower = text.toLowerCase();
                        const foundKeywords = STRESS_KEYWORDS.filter(kw => lower.includes(kw));
                        const keywordScore = Math.min(1, foundKeywords.length * 0.3);
                        
                        const semanticFraudIntent = maxSimilarity > 0.5 ? maxSimilarity : 0;
                        const compositeScore = Math.min(1, (semanticFraudIntent * 0.6) + (emotions.fear * 0.2) + (emotions.anger * 0.2) + (keywordScore * 0.4));
                        
                        self.postMessage({
                            type: 'RESULT', id, emotions, semanticFraudIntent, compositeScore, foundKeywords,
                            label: compositeScore > 0.75 ? 'HIGH_RISK' : compositeScore > 0.45 ? 'SUSPICIOUS' : 'SAFE',
                        });
                    } catch (err) { self.postMessage({ type: 'RESULT', id, error: String(err) }); }
                }
            };
        `;

        const blob = new Blob([workerCode], { type: "application/javascript" })
        const workerUrl = URL.createObjectURL(blob)
        const worker = new Worker(workerUrl, { type: "module" })

        worker.onmessage = (e: MessageEvent) => {
            const { type, status, id, error, ...data } = e.data

            if (type === "STATUS") {
                setWorkerStatus(status)
                return
            }

            if (type === "RESULT" && id !== undefined) {
                const originalText = pendingRef.current.get(id) ?? ""
                pendingRef.current.delete(id)

                if (error) { console.warn("[useSentimentAnalysis] Worker error:", error); return }

                const result: SentimentResult = {
                    text: originalText,
                    label: data.label,
                    compositeScore: data.compositeScore,
                    emotions: data.emotions,
                    semanticFraudIntent: data.semanticFraudIntent,
                    foundKeywords: data.foundKeywords ?? [],
                    timestamp: Date.now(),
                }

                setResults(prev => [result, ...prev].slice(0, 30))
                setLatestResult(result)
                onResult?.(result)
            }
        }

        worker.onerror = (e) => {
            console.warn("[useSentimentAnalysis] Worker error:", e)
            setWorkerStatus("error")
        }

        workerRef.current = worker

        // Initialize the model inside the worker
        worker.postMessage({ type: "INIT" })

        return () => {
            worker.terminate()
            URL.revokeObjectURL(workerUrl)
            workerRef.current = null
            setWorkerStatus("idle")
        }
    }, [enabled])

    const analyzeText = useCallback((text: string) => {
        if (!workerRef.current || workerStatus !== "ready" || !text.trim()) return

        const id = ++idRef.current
        pendingRef.current.set(id, text)
        workerRef.current.postMessage({ type: "ANALYZE", text, id })
    }, [workerStatus])

    return { analyzeText, results, workerStatus, latestResult }
}
