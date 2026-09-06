"use client"

import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import { ScamSignal } from "./useScamDetection"

// Lazy-load MediaPipe — large WASM bundle, load only when needed
let FaceLandmarker: typeof import("@mediapipe/tasks-vision").FaceLandmarker | null = null
let FilesetResolver: typeof import("@mediapipe/tasks-vision").FilesetResolver | null = null

const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
const FACE_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

const FRAME_INTERVAL_MS = 100  // 10fps analysis (GPU handles 30fps render)
const HISTORY_LEN = 30         // 3 seconds of history at 10fps

export interface BlendshapeScores {
    // Key expression blendshapes we care about
    eyeBlinkLeft: number
    eyeBlinkRight: number
    eyeLookDownLeft: number
    eyeLookDownRight: number
    eyeLookInLeft: number
    eyeLookInRight: number
    eyeLookOutLeft: number
    eyeLookOutRight: number
    eyeLookUpLeft: number
    eyeLookUpRight: number
    mouthSmileLeft: number
    mouthSmileRight: number
    mouthFrownLeft: number
    mouthFrownRight: number
    browDownLeft: number
    browDownRight: number
    browInnerUp: number
    jawOpen: number
    mouthPressLeft: number
    mouthPressRight: number
    [key: string]: number
}

export interface MediaPipeFaceResult {
    faceDetected: boolean
    faceCount: number
    blendshapes: BlendshapeScores
    gazeX: number           // -1 (left) to +1 (right)
    gazeY: number           // -1 (up) to +1 (down)
    headYaw: number         // head rotation L/R in degrees
    headPitch: number       // head tilt U/D in degrees
    headPoseVariance: number// variance of yaw/pitch over 3 seconds (micro-tremors)
    blinkRate: number       // blinks per minute
    stressScore: number     // 0-100
    isModelLoaded: boolean
}

const DEFAULT_BLENDSHAPES: BlendshapeScores = {
    eyeBlinkLeft: 0, eyeBlinkRight: 0,
    eyeLookDownLeft: 0, eyeLookDownRight: 0,
    eyeLookInLeft: 0, eyeLookInRight: 0,
    eyeLookOutLeft: 0, eyeLookOutRight: 0,
    eyeLookUpLeft: 0, eyeLookUpRight: 0,
    mouthSmileLeft: 0, mouthSmileRight: 0,
    mouthFrownLeft: 0, mouthFrownRight: 0,
    browDownLeft: 0, browDownRight: 0,
    browInnerUp: 0, jawOpen: 0,
    mouthPressLeft: 0, mouthPressRight: 0,
}

interface UseMediaPipeFaceOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>
    enabled: boolean
    updateScore: (signal: ScamSignal, value: number) => void
}

let faceLandmarkerInstance: import("@mediapipe/tasks-vision").FaceLandmarker | null = null
let modelLoading = false

async function getFaceLandmarker() {
    if (faceLandmarkerInstance) return faceLandmarkerInstance
    if (modelLoading) {
        // Wait for existing load
        while (modelLoading) await new Promise(r => setTimeout(r, 100))
        return faceLandmarkerInstance
    }

    modelLoading = true
    try {
        const vision = await import("@mediapipe/tasks-vision")
        FaceLandmarker = vision.FaceLandmarker
        FilesetResolver = vision.FilesetResolver

        const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN)
        faceLandmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: FACE_MODEL_URL,
                delegate: "GPU",
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: "VIDEO",
            numFaces: 3,  // Detect up to 3 faces (extra person detection)
        })
    } finally {
        modelLoading = false
    }
    return faceLandmarkerInstance
}

export function useMediaPipeFace({
    videoRef, enabled, updateScore
}: UseMediaPipeFaceOptions): MediaPipeFaceResult {
    const [faceDetected, setFaceDetected] = useState(false)
    const [faceCount, setFaceCount] = useState(0)
    const [blendshapes, setBlendshapes] = useState<BlendshapeScores>(DEFAULT_BLENDSHAPES)
    const [gazeX, setGazeX] = useState(0)
    const [gazeY, setGazeY] = useState(0)
    const [headYaw, setHeadYaw] = useState(0)
    const [headPitch, setHeadPitch] = useState(0)
    const [headPoseVariance, setHeadPoseVariance] = useState(0)
    const [blinkRate, setBlinkRate] = useState(0)
    const [stressScore, setStressScore] = useState(0)
    const [isModelLoaded, setIsModelLoaded] = useState(false)

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const blinkHistoryRef = useRef<number[]>([])  // timestamps of blinks
    const lastBlinkStateRef = useRef(false)
    const poseHistoryRef = useRef<{yaw: number, pitch: number}[]>([])
    const frameTimestampRef = useRef(0)

    const analyzeFrame = useCallback(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return

        const landmarker = await getFaceLandmarker()
        if (!landmarker) return

        setIsModelLoaded(prev => {
            if (!prev) return true;
            return prev;
        })

        const now = performance.now()
        // Prevent same-timestamp calls (required by MediaPipe VIDEO mode)
        if (now <= frameTimestampRef.current) return
        frameTimestampRef.current = now

        try {
            const results = landmarker.detectForVideo(video, now)
            const detected = results.faceLandmarks && results.faceLandmarks.length > 0
            const count = results.faceLandmarks?.length ?? 0

            setFaceDetected(detected)
            setFaceCount(count)

            if (!detected) {
                updateScore("facial", 35)  // No face = moderate flag
                setBlendshapes(DEFAULT_BLENDSHAPES)
                return
            }

            // ── Parse blendshapes ──────────────────────────────────────────────
            const bs = results.faceBlendshapes?.[0]?.categories ?? []
            const bsMap: BlendshapeScores = { ...DEFAULT_BLENDSHAPES }
            bs.forEach(cat => { bsMap[cat.categoryName] = cat.score })
            setBlendshapes(bsMap)

            // ── Gaze estimation from iris landmarks ───────────────────────────
            // Landmarks 473-476 = right iris, 468-472 = left iris
            const lm = results.faceLandmarks[0]
            if (lm.length >= 477) {
                // Right iris center vs eye corners
                const rightIris = lm[473]
                const leftCorner = lm[362]
                const rightCorner = lm[263]
                const eyeWidth = Math.abs(rightCorner.x - leftCorner.x)
                const eyeMidX = (leftCorner.x + rightCorner.x) / 2

                const rawGazeX = eyeWidth > 0.001
                    ? (rightIris.x - eyeMidX) / eyeWidth * 4
                    : 0

                // Left iris
                const leftIris = lm[468]
                const lLeftCorner = lm[33]
                const lRightCorner = lm[133]
                const lEyeWidth = Math.abs(lRightCorner.x - lLeftCorner.x)
                const lEyeMidY = (lLeftCorner.y + lRightCorner.y) / 2
                const rawGazeY = lEyeWidth > 0.001
                    ? (leftIris.y - lEyeMidY) / lEyeWidth * 4
                    : 0

                setGazeX(Math.max(-1, Math.min(1, rawGazeX)))
                setGazeY(Math.max(-1, Math.min(1, rawGazeY)))
            }

            // ── Head pose from transformation matrix ──────────────────────────
            let currentYaw = 0;
            let currentPitch = 0;
            const matrix = results.facialTransformationMatrixes?.[0]?.data
            if (matrix) {
                currentYaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI)
                currentPitch = Math.atan2(-matrix[9], Math.sqrt(matrix[1] ** 2 + matrix[5] ** 2)) * (180 / Math.PI)
                setHeadYaw(currentYaw)
                setHeadPitch(currentPitch)
                
                // Track micro-tremors (variance over last 3 seconds / 30 frames)
                poseHistoryRef.current.push({yaw: currentYaw, pitch: currentPitch})
                if (poseHistoryRef.current.length > HISTORY_LEN) {
                    poseHistoryRef.current.shift()
                }
                
                if (poseHistoryRef.current.length >= 10) {
                    let sumYaw = 0, sumPitch = 0;
                    for (const p of poseHistoryRef.current) { sumYaw += p.yaw; sumPitch += p.pitch; }
                    const avgYaw = sumYaw / poseHistoryRef.current.length;
                    const avgPitch = sumPitch / poseHistoryRef.current.length;
                    
                    let varYaw = 0, varPitch = 0;
                    for (const p of poseHistoryRef.current) {
                        varYaw += Math.pow(p.yaw - avgYaw, 2);
                        varPitch += Math.pow(p.pitch - avgPitch, 2);
                    }
                    varYaw /= poseHistoryRef.current.length;
                    varPitch /= poseHistoryRef.current.length;
                    
                    // Cap variance to something reasonable, map 0-10 to 0-100 score
                    const totalVariance = varYaw + varPitch;
                    setHeadPoseVariance(Math.min(100, totalVariance * 5));
                }
            }

            // ── Blink detection ───────────────────────────────────────────────
            const blinkL = bsMap.eyeBlinkLeft
            const blinkR = bsMap.eyeBlinkRight
            const blinking = blinkL > 0.5 && blinkR > 0.5
            if (blinking && !lastBlinkStateRef.current) {
                blinkHistoryRef.current.push(Date.now())
            }
            lastBlinkStateRef.current = blinking

            // Keep last 60 seconds of blinks
            const cutoff = Date.now() - 60000
            blinkHistoryRef.current = blinkHistoryRef.current.filter(t => t > cutoff)
            setBlinkRate(blinkHistoryRef.current.length)  // blinks/minute

            // ── Stress score computation ──────────────────────────────────────
            // Using blendshape combinations that correlate with stress/deception
            const browFurrow = (bsMap.browDownLeft + bsMap.browDownRight) / 2 * 100
            const lipCompress = (bsMap.mouthPressLeft + bsMap.mouthPressRight) / 2 * 100
            const innerBrowRaise = bsMap.browInnerUp * 100  // fear/surprise
            const mouthFrown = (bsMap.mouthFrownLeft + bsMap.mouthFrownRight) / 2 * 100

            // Extra face = cheating risk
            const multiplePeopleScore = count > 1 ? 80 : 0

            const rawStress = Math.max(
                browFurrow * 0.3 + lipCompress * 0.3 + innerBrowRaise * 0.2 + mouthFrown * 0.2,
                multiplePeopleScore
            )

            // Very low blink rate (<5/min) = high concentration or screen staring = not necessarily bad
            // Very high (>30/min) = nervousness
            const currentBlinkRate = blinkHistoryRef.current.length
            const blinkStress = currentBlinkRate > 30 ? 40 : currentBlinkRate < 3 ? 20 : 0

            const finalStress = Math.min(100, Math.round(rawStress + blinkStress * 0.3))
            setStressScore(finalStress)
            updateScore("facial", finalStress)

        } catch (err) {
            console.warn("[useMediaPipeFace] inference error:", err)
        }
    }, [videoRef, updateScore])

    const activeRef = useRef(false)

    useEffect(() => {
        if (!enabled) {
            updateScore("facial", 0)
            setFaceDetected(false)
            setStressScore(0)
            activeRef.current = false
            return
        }

        activeRef.current = true

        const loop = async () => {
            if (!activeRef.current) return
            await analyzeFrame()
            if (activeRef.current) {
                intervalRef.current = setTimeout(loop, FRAME_INTERVAL_MS)
            }
        }
        loop()

        return () => {
            activeRef.current = false
            if (intervalRef.current) clearTimeout(intervalRef.current)
        }
    }, [enabled, analyzeFrame, updateScore])

    return useMemo(() => ({
        faceDetected, faceCount, blendshapes,
        gazeX, gazeY, headYaw, headPitch, headPoseVariance,
        blinkRate, stressScore, isModelLoaded
    }), [
        faceDetected, faceCount, blendshapes,
        gazeX, gazeY, headYaw, headPitch, headPoseVariance,
        blinkRate, stressScore, isModelLoaded
    ])
}
