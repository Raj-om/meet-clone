/**
 * IsolationForest.ts
 *
 * Pure-JS implementation of the Isolation Forest algorithm for unsupervised
 * anomaly detection. No TF.js needed — just binary random partitioning trees.
 *
 * Key insight: anomalies are ISOLATED FASTER because they occupy sparse regions
 * of feature space. Measure anomaly score by how short the average path length
 * is across all isolation trees.
 *
 * Runs in ~0.5ms per prediction — safe for main thread.
 */

// Feature vector for one frame of observation
export interface IFFeatureVector {
    deepfake: number
    voice: number
    facial: number
    behavioral: number
    keyword: number
    lstmAnomaly: number
}

interface ITreeNode {
    isLeaf: boolean
    size?: number       // Only on leaf
    splitFeature?: keyof IFFeatureVector
    splitValue?: number
    left?: ITreeNode
    right?: ITreeNode
}

// ── Harmonic number for normalizing path length ───────────────────────────
function c(n: number): number {
    if (n <= 1) return 0
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n)
}

// ── Build one isolation tree ──────────────────────────────────────────────
function buildTree(data: IFFeatureVector[], depth: number, maxDepth: number): ITreeNode {
    if (data.length <= 1 || depth >= maxDepth) {
        return { isLeaf: true, size: data.length }
    }

    const features = Object.keys(data[0]) as (keyof IFFeatureVector)[]
    const feature = features[Math.floor(Math.random() * features.length)]

    const values = data.map(d => d[feature])
    const min = Math.min(...values)
    const max = Math.max(...values)

    if (min === max) {
        return { isLeaf: true, size: data.length }
    }

    const splitValue = min + Math.random() * (max - min)

    const left = data.filter(d => d[feature] <= splitValue)
    const right = data.filter(d => d[feature] > splitValue)

    return {
        isLeaf: false,
        splitFeature: feature,
        splitValue,
        left: buildTree(left, depth + 1, maxDepth),
        right: buildTree(right, depth + 1, maxDepth),
    }
}

// ── Path length for a single sample through one tree ─────────────────────
function pathLength(point: IFFeatureVector, node: ITreeNode, depth: number): number {
    if (node.isLeaf) {
        return depth + c(node.size ?? 1)
    }
    if (point[node.splitFeature!] <= node.splitValue!) {
        return pathLength(point, node.left!, depth + 1)
    }
    return pathLength(point, node.right!, depth + 1)
}

// ── Isolation Forest Class ────────────────────────────────────────────────
export class IsolationForest {
    private trees: ITreeNode[] = []
    private isTrained = false
    private sampleSize: number
    private numTrees: number

    constructor(numTrees = 100, sampleSize = 256) {
        this.numTrees = numTrees
        this.sampleSize = sampleSize
    }

    /** Train the forest on a baseline dataset of "normal" frames */
    fit(data: IFFeatureVector[]) {
        if (data.length < 8) return  // Not enough data
        this.trees = []
        const maxDepth = Math.ceil(Math.log2(Math.min(this.sampleSize, data.length)))

        for (let i = 0; i < this.numTrees; i++) {
            // Random subsample (with replacement)
            const sample: IFFeatureVector[] = []
            const n = Math.min(this.sampleSize, data.length)
            for (let j = 0; j < n; j++) {
                sample.push(data[Math.floor(Math.random() * data.length)])
            }
            this.trees.push(buildTree(sample, 0, maxDepth))
        }
        this.isTrained = true
    }

    /** Returns 0–100 anomaly score. Higher = more anomalous */
    score(point: IFFeatureVector): number {
        if (!this.isTrained || this.trees.length === 0) return 0

        const avgPath = this.trees.reduce((sum, tree) => sum + pathLength(point, tree, 0), 0) / this.trees.length
        const normPath = c(this.sampleSize)
        if (normPath === 0) return 0

        // Anomaly score: 2^(-avgPath/c(n)), ranges 0.5 (normal) → 1.0 (anomalous)
        const rawScore = Math.pow(2, -avgPath / normPath)

        // Rescale from [0.5, 1.0] → [0, 100]
        return Math.min(100, Math.max(0, Math.round((rawScore - 0.5) * 200)))
    }

    get trained() { return this.isTrained }
}

export const examIsolationForest = new IsolationForest(100, 256)
