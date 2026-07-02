/**
 * lstmWorker.ts
 * TF.js LSTM Autoencoder running in a Web Worker.
 * tf is loaded at runtime via importScripts — declared as any for TS compatibility.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const tf: any

export interface LSTMWorkerInput {
    type: 'OBSERVE' | 'STATUS'
    frame?: number[]
}

export interface LSTMWorkerOutput {
    type: 'STATUS' | 'ANOMALY_SCORE' | 'TRAINING_COMPLETE'
    phase: 'BOOTSTRAP' | 'TRAINING' | 'MONITORING'
    anomalyScore: number
    confidence: number
    framesCollected: number
    trainLoss?: number
}

const WINDOW_SIZE = 60
const FEATURE_DIM = 5
const BOOTSTRAP_FRAMES = 900
const EPOCHS = 5

const frameBuffer: number[][] = []
const windowBuffer: number[][] = []
let model: any = null
let phase: 'BOOTSTRAP' | 'TRAINING' | 'MONITORING' = 'BOOTSTRAP'
let lastAnomalyScore = 0
let lastTrainLoss = 0
let tfLoaded = false

async function loadTF() {
    if (tfLoaded) return
    // @ts-expect-error importScripts is available in the classic worker runtime.
    self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')
    tfLoaded = true
}

function createModel() {
    const input = tf.input({ shape: [WINDOW_SIZE, FEATURE_DIM] })
    const encoded = tf.layers.lstm({ units: 32, returnSequences: false }).apply(input)
    const repeated = tf.layers.repeatVector({ n: WINDOW_SIZE }).apply(encoded)
    const decoded = tf.layers.lstm({ units: 32, returnSequences: true }).apply(repeated)
    const output = tf.layers.timeDistributed({
        layer: tf.layers.dense({ units: FEATURE_DIM, activation: 'sigmoid' })
    }).apply(decoded)
    const m = tf.model({ inputs: input, outputs: output })
    m.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' })
    return m
}

function buildWindows(frames: number[][]): number[][][] {
    const windows: number[][][] = []
    for (let i = 0; i <= frames.length - WINDOW_SIZE; i++) {
        windows.push(frames.slice(i, i + WINDOW_SIZE))
    }
    return windows
}

async function trainModel(frames: number[][]) {
    phase = 'TRAINING'
    postMessage({ type: 'STATUS', phase, anomalyScore: 0, confidence: 0, framesCollected: frames.length })
    const windows = buildWindows(frames)
    if (windows.length < 10) { phase = 'MONITORING'; return }
    const X = tf.tensor3d(windows)
    await model.fit(X, X, {
        epochs: EPOCHS, batchSize: 32, shuffle: true,
        callbacks: {
            onEpochEnd: (_epoch: any, logs: any) => { lastTrainLoss = logs?.loss ?? 0 }
        }
    })
    X.dispose()
    phase = 'MONITORING'
    postMessage({ type: 'TRAINING_COMPLETE', phase: 'MONITORING', anomalyScore: 0, confidence: 1, framesCollected: frames.length, trainLoss: lastTrainLoss })
}

function computeAnomalyScore(window: number[][]): number {
    if (!model) return 0
    const inputTensor = tf.tensor3d([window])
    const recon = model.predict(inputTensor)
    const diff = tf.sub(inputTensor, recon)
    const mse = tf.mean(tf.square(diff)).dataSync()[0]
    inputTensor.dispose(); recon.dispose(); diff.dispose()
    return Math.min(100, Math.round(mse * 1500))
}

self.onmessage = async (e: MessageEvent<LSTMWorkerInput>) => {
    const { type, frame } = e.data
    if (type === 'STATUS') {
        postMessage({ type: 'STATUS', phase, anomalyScore: lastAnomalyScore, confidence: phase === 'MONITORING' ? 0.9 : 0, framesCollected: frameBuffer.length, trainLoss: lastTrainLoss } as LSTMWorkerOutput)
        return
    }
    if (type !== 'OBSERVE' || !frame) return
    if (!tfLoaded) { try { await loadTF() } catch { return } }
    windowBuffer.push(frame)
    if (windowBuffer.length > WINDOW_SIZE) windowBuffer.shift()
    if (phase === 'BOOTSTRAP') {
        frameBuffer.push(frame)
        if (frameBuffer.length >= BOOTSTRAP_FRAMES) {
            if (!model) model = createModel()
            await trainModel([...frameBuffer])
        } else if (frameBuffer.length % 50 === 0) {
            postMessage({ type: 'STATUS', phase: 'BOOTSTRAP', anomalyScore: 0, confidence: 0, framesCollected: frameBuffer.length } as LSTMWorkerOutput)
        }
    } else if (phase === 'MONITORING' && windowBuffer.length >= WINDOW_SIZE) {
        lastAnomalyScore = computeAnomalyScore([...windowBuffer])
        postMessage({ type: 'ANOMALY_SCORE', phase: 'MONITORING', anomalyScore: lastAnomalyScore, confidence: Math.min(1, frameBuffer.length / BOOTSTRAP_FRAMES), framesCollected: frameBuffer.length } as LSTMWorkerOutput)
    }
}
