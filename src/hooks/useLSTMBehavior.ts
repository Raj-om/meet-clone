"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { LSTMWorkerOutput } from "@/workers/lstmWorker"
import { GazeDirection } from "./useGazeTracking"

export type LSTMPhase = "BOOTSTRAP" | "TRAINING" | "MONITORING" | "INACTIVE"

export interface LSTMBehaviorResult {
    anomalyScore: number        // 0–100
    confidence: number          // 0–1 (grows as bootstrap fills)
    phase: LSTMPhase
    framesCollected: number
    trainLoss: number
    bootstrapProgress: number   // 0–100 percentage
}

interface UseLSTMBehaviorOptions {
    enabled: boolean
    gazeDirection: GazeDirection
    faceCount: number
    stressLevel: number
    objectCount: number
}

const BOOTSTRAP_FRAMES = 900  // 90 seconds @ 10fps

// ── Normalize raw sensor values to 0–1 ─────────────────────────────────────
function normalize(gazeDir: GazeDirection, faceCount: number, stressLevel: number, objectCount: number) {
    const gazeMap: Record<GazeDirection, number> = {
        FORWARD: 0.0, UP: 0.3, DOWN: 0.5, LEFT: 0.8, RIGHT: 0.8, NO_FACE: 1.0
    }
    return [
        gazeMap[gazeDir] ?? 0.5,                       // gazeX (proxy)
        gazeDir === "DOWN" || gazeDir === "UP" ? 0.6 : 0.1, // gazeY
        Math.min(1, faceCount / 2),                    // faceCount (0=none, 0.5=1, 1=2+)
        stressLevel / 100,                             // stressLevel
        Math.min(1, objectCount / 3),                  // objectCount
    ]
}

export function useLSTMBehavior({
    enabled, gazeDirection, faceCount, stressLevel, objectCount
}: UseLSTMBehaviorOptions): LSTMBehaviorResult {
    const workerRef = useRef<Worker | null>(null)
    const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const [result, setResult] = useState<LSTMBehaviorResult>({
        anomalyScore: 0,
        confidence: 0,
        phase: "INACTIVE",
        framesCollected: 0,
        trainLoss: 0,
        bootstrapProgress: 0,
    })

    // Snapshot latest values in a ref so the interval always has fresh data
    const latestRef = useRef({ gazeDirection, faceCount, stressLevel, objectCount })
    useEffect(() => {
        latestRef.current = { gazeDirection, faceCount, stressLevel, objectCount }
    }, [gazeDirection, faceCount, stressLevel, objectCount])

    // ── Spawn worker when enabled ──────────────────────────────────────────
    useEffect(() => {
        if (!enabled) {
            workerRef.current?.terminate()
            workerRef.current = null
            if (frameTimerRef.current) clearInterval(frameTimerRef.current)
            setResult(r => ({ ...r, phase: "INACTIVE" }))
            return
        }

        // Create the LSTM worker via Blob URL so it works with Next.js bundler
        const workerCode = `
            importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
            ${getLSTMWorkerSourceCode()}
        `
        const blob = new Blob([workerCode], { type: "application/javascript" })
        const workerUrl = URL.createObjectURL(blob)
        const worker = new Worker(workerUrl)
        workerRef.current = worker

        worker.onmessage = (e: MessageEvent<LSTMWorkerOutput>) => {
            const { anomalyScore, confidence, phase, framesCollected, trainLoss } = e.data
            setResult({
                anomalyScore,
                confidence,
                phase: phase as LSTMPhase,
                framesCollected,
                trainLoss: trainLoss ?? 0,
                bootstrapProgress: Math.min(100, Math.round((framesCollected / BOOTSTRAP_FRAMES) * 100)),
            })
        }

        worker.onerror = (err) => {
            console.warn("[LSTM Worker] Error:", err.message)
        }

        // Feed frames at 10fps
        frameTimerRef.current = setInterval(() => {
            const { gazeDirection, faceCount, stressLevel, objectCount } = latestRef.current
            const frame = normalize(gazeDirection, faceCount, stressLevel, objectCount)
            worker.postMessage({ type: "OBSERVE", frame })
        }, 100)

        return () => {
            worker.terminate()
            URL.revokeObjectURL(workerUrl)
            if (frameTimerRef.current) clearInterval(frameTimerRef.current)
        }
    }, [enabled])

    return result
}

// ── Inline LSTM worker logic (avoids separate file import issues) ─────────
function getLSTMWorkerSourceCode(): string {
    return `
const WINDOW_SIZE = 60;
const FEATURE_DIM = 5;
const BOOTSTRAP_FRAMES = 900;
const EPOCHS = 5;

let frameBuffer = [];
let windowBuffer = [];
let model = null;
let phase = 'BOOTSTRAP';
let lastAnomalyScore = 0;
let lastTrainLoss = 0;

function createModel() {
    const input = tf.input({ shape: [WINDOW_SIZE, FEATURE_DIM] });
    const encoded = tf.layers.lstm({ units: 32, returnSequences: false }).apply(input);
    const repeated = tf.layers.repeatVector({ n: WINDOW_SIZE }).apply(encoded);
    const decoded = tf.layers.lstm({ units: 32, returnSequences: true }).apply(repeated);
    const output = tf.layers.timeDistributed({
        layer: tf.layers.dense({ units: FEATURE_DIM, activation: 'sigmoid' })
    }).apply(decoded);
    const m = tf.model({ inputs: input, outputs: output });
    m.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
    return m;
}

function buildWindows(frames) {
    const windows = [];
    for (let i = 0; i <= frames.length - WINDOW_SIZE; i++) {
        windows.push(frames.slice(i, i + WINDOW_SIZE));
    }
    return windows;
}

async function trainModel(frames) {
    phase = 'TRAINING';
    self.postMessage({ type: 'STATUS', phase, anomalyScore: 0, confidence: 0, framesCollected: frames.length });
    const windows = buildWindows(frames);
    if (windows.length < 10) { phase = 'MONITORING'; return; }
    model = model || createModel();
    const X = tf.tensor3d(windows);
    await model.fit(X, X, {
        epochs: EPOCHS, batchSize: 32, shuffle: true,
        callbacks: { onEpochEnd: (e, logs) => { lastTrainLoss = logs ? logs.loss : 0; } }
    });
    X.dispose();
    phase = 'MONITORING';
    self.postMessage({ type: 'TRAINING_COMPLETE', phase: 'MONITORING', anomalyScore: 0, confidence: 1, framesCollected: frames.length, trainLoss: lastTrainLoss });
}

function computeAnomalyScore(window) {
    if (!model) return 0;
    const inputTensor = tf.tensor3d([window]);
    const recon = model.predict(inputTensor);
    const diff = tf.sub(inputTensor, recon);
    const mse = tf.mean(tf.square(diff)).dataSync()[0];
    inputTensor.dispose(); recon.dispose(); diff.dispose();
    return Math.min(100, Math.round(mse * 1500));
}

self.onmessage = async function(e) {
    const { type, frame } = e.data;
    if (type === 'STATUS') {
        self.postMessage({ type: 'STATUS', phase, anomalyScore: lastAnomalyScore, confidence: phase === 'MONITORING' ? 0.9 : 0, framesCollected: frameBuffer.length, trainLoss: lastTrainLoss });
        return;
    }
    if (type !== 'OBSERVE' || !frame) return;
    windowBuffer.push(frame);
    if (windowBuffer.length > WINDOW_SIZE) windowBuffer.shift();
    if (phase === 'BOOTSTRAP') {
        frameBuffer.push(frame);
        if (frameBuffer.length >= BOOTSTRAP_FRAMES) {
            model = createModel();
            await trainModel([...frameBuffer]);
        } else if (frameBuffer.length % 50 === 0) {
            self.postMessage({ type: 'STATUS', phase: 'BOOTSTRAP', anomalyScore: 0, confidence: 0, framesCollected: frameBuffer.length });
        }
    } else if (phase === 'MONITORING' && windowBuffer.length >= WINDOW_SIZE) {
        lastAnomalyScore = computeAnomalyScore([...windowBuffer]);
        self.postMessage({ type: 'ANOMALY_SCORE', phase: 'MONITORING', anomalyScore: lastAnomalyScore, confidence: Math.min(1, frameBuffer.length / BOOTSTRAP_FRAMES), framesCollected: frameBuffer.length });
    }
};
`
}
