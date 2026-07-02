/**
 * whisperWorker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Worker for on-device, privacy-first speech-to-text using:
 *   • Transformers.js v3 (@huggingface/transformers — already in package.json)
 *   • Model: onnx-community/whisper-tiny.en  (~40 MB, cached in IndexedDB)
 *   • Backend: WebGPU → falls back to WASM automatically
 *
 * Research basis: 2025/2026 trend toward zero-server, client-side AI with
 * WebGPU acceleration (3–5× faster than WASM on supported hardware).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Vite/Next.js worker boundary — importScripts not needed; bundler handles this
import { pipeline, env } from "@huggingface/transformers"

// ── Configuration ─────────────────────────────────────────────────────────────
env.allowLocalModels = false          // use HuggingFace Hub
env.useBrowserCache  = true           // cache model weights in IndexedDB

const MODEL_ID  = "onnx-community/whisper-tiny.en"
const TASK      = "automatic-speech-recognition"

// ── Message types (mirrored in useWhisperTranscription.ts) ───────────────────
export type WhisperInMsg =
    | { type: "INIT" }
    | { type: "TRANSCRIBE"; pcm: Float32Array; sampleRate: number }

export type WhisperOutMsg =
    | { type: "READY" }
    | { type: "LOADING"; progress: number; stage: string }
    | { type: "TRANSCRIPT"; text: string; isFinal: boolean }
    | { type: "ERROR"; message: string }

// ── Worker state ──────────────────────────────────────────────────────────────
let transcriber: any = null
let loading = false

// ── Progress callback (forwarded to main thread) ──────────────────────────────
function onProgress(info: any) {
    if (info.status === "progress") {
        const pct = info.total > 0 ? Math.round((info.loaded / info.total) * 100) : 0
        self.postMessage({ type: "LOADING", progress: pct, stage: info.file ?? "model" } satisfies WhisperOutMsg)
    }
}

// ── Load the model ────────────────────────────────────────────────────────────
async function loadModel() {
    if (transcriber || loading) return
    loading = true
    try {
        transcriber = await pipeline(TASK, MODEL_ID, {
            device: "webgpu",           // auto-falls back to "wasm" if unavailable
            progress_callback: onProgress,
        })
        self.postMessage({ type: "READY" } satisfies WhisperOutMsg)
    } catch (gpuErr) {
        // WebGPU not available — try WASM
        console.warn("[WhisperWorker] WebGPU unavailable, falling back to WASM:", gpuErr)
        try {
            transcriber = await pipeline(TASK, MODEL_ID, {
                device: "wasm",
                progress_callback: onProgress,
            })
            self.postMessage({ type: "READY" } satisfies WhisperOutMsg)
        } catch (err: any) {
            self.postMessage({ type: "ERROR", message: String(err?.message ?? err) } satisfies WhisperOutMsg)
        }
    } finally {
        loading = false
    }
}

// ── Handle messages from main thread ─────────────────────────────────────────
self.onmessage = async (e: MessageEvent<WhisperInMsg>) => {
    const msg = e.data

    if (msg.type === "INIT") {
        await loadModel()
        return
    }

    if (msg.type === "TRANSCRIBE") {
        if (!transcriber) {
            self.postMessage({ type: "ERROR", message: "Model not loaded yet" } satisfies WhisperOutMsg)
            return
        }
        try {
            const result = await transcriber(msg.pcm, {
                sampling_rate: msg.sampleRate,
                // Return only final text — no chunk timestamps needed for captions
                return_timestamps: false,
            })
            const text: string = (result as any)?.text?.trim() ?? ""
            if (text) {
                self.postMessage({ type: "TRANSCRIPT", text, isFinal: true } satisfies WhisperOutMsg)
            }
        } catch (err: any) {
            self.postMessage({ type: "ERROR", message: String(err?.message ?? err) } satisfies WhisperOutMsg)
        }
    }
}
