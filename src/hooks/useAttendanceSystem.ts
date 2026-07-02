"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// ── face-api.js types (lazy loaded) ──────────────────────────────────────────
type FaceApi = typeof import("face-api.js")
let faceApiModule: FaceApi | null = null
let faceApiLoading = false
let faceApiReady = false

async function loadFaceAPI(): Promise<FaceApi | null> {
    if (faceApiReady && faceApiModule) return faceApiModule
    if (faceApiLoading) return null
    try {
        faceApiLoading = true
        const fapi = await import("face-api.js")
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"
        await Promise.all([
            fapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            fapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            fapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        faceApiModule = fapi
        faceApiReady = true
        faceApiLoading = false
        return fapi
    } catch (err) {
        faceApiLoading = false
        console.warn("face-api.js load failed, using MediaPipe fallback:", err)
        return null
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
    userId: string
    displayName: string
    joinedAt: number
    lastVerifiedAt: number
    presentDurationMs: number
    absencePeriods: AbsencePeriod[]
    verificationCount: number
    verificationFailures: number
    livenessScore: number
    faceDescriptor: Float32Array | null   // 128-dim ArcFace embedding from face-api.js
    mpEmbedding: number[] | null          // MediaPipe fallback embedding
    status: "present" | "absent" | "away" | "unverified"
    geolocation?: { lat: number; lng: number; accuracy: number }
    deviceFingerprint?: string
}

export interface AbsencePeriod {
    start: number
    end: number | null
    reason: "tab_switch" | "no_face" | "multiple_faces" | "face_mismatch" | "manual"
}

export interface AttendanceSession {
    meetingId: string
    hostId: string
    startedAt: number
    endedAt: number | null
    mode: "face" | "manual"
    minimumPresentPercent: number
}

export interface LivenessChallenge {
    type: "blink" | "turn_left" | "turn_right" | "nod"
    issued: boolean
    passed: boolean
    expiresAt: number
}

export interface AttendanceExport {
    meetingId: string
    generatedAt: string
    duration: string
    totalParticipants: number
    minimumRequiredPercent: number
    records: AttendanceExportRow[]
    summary: { passed: number; failed: number; partial: number; averagePresence: number }
}

export interface AttendanceExportRow {
    name: string
    userId: string
    status: string
    joinedAt: string
    presentDuration: string
    presentPercent: number
    livenessScore: number
    verifications: number
    failures: number
    result: "PASS" | "FAIL" | "PARTIAL"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
    const dot = a.reduce((acc, v, i) => acc + v * b[i], 0)
    const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0))
    const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0))
    return (na && nb) ? dot / (na * nb) : 0
}

function euclideanDist(a: Float32Array, b: Float32Array): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
    return Math.sqrt(sum)
}

function formatDur(ms: number): string {
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
}

function mpEmbedFromLandmarks(landmarks: number[][]): number[] {
    const KEY = [0,4,8,12,16,17,21,26,27,28,29,30,31,32,33,37,38,39,40,41,42,43,46,48,49,50,51,52,53,54,55,56,57,58,59,61,62,63,64,65,66,67]
    const emb: number[] = []
    for (const idx of KEY) { const lm = landmarks[idx] || [0,0,0]; emb.push(lm[0], lm[1], lm[2]) }
    const norm = Math.sqrt(emb.reduce((a,v) => a+v*v, 0)) || 1
    return emb.map(v => v/norm).slice(0, 128)
}

async function getFingerprint(): Promise<string> {
    try {
        const FPjs = await import("@fingerprintjs/fingerprintjs")
        const fp = await FPjs.default.load()
        const result = await fp.get()
        return result.visitorId
    } catch {
        // Fallback manual fingerprint
        const ua = navigator.userAgent
        const sc = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const raw = `${ua}|${sc}|${tz}|${navigator.language}`
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,16)
    }
}

function makeRecord(userId: string, displayName: string): AttendanceRecord {
    return {
        userId, displayName,
        joinedAt: Date.now(), lastVerifiedAt: Date.now(),
        presentDurationMs: 0, absencePeriods: [],
        verificationCount: 0, verificationFailures: 0,
        livenessScore: 0, faceDescriptor: null, mpEmbedding: null,
        status: "unverified",
    }
}

// ── Hook Options & Return ──────────────────────────────────────────────────────

interface UseAttendanceOptions {
    socket: unknown | null
    userId: string
    displayName: string
    isHost: boolean
    meetingId: string
    mode?: string
    // From MediaPipe
    faceCount: number
    blinkRate: number
    headYaw: number
    headPitch: number
    faceDetected: boolean
    faceLandmarks?: number[][] | null
    // Video element for face-api.js enrollment
    videoRef?: React.RefObject<HTMLVideoElement | null>
}

export interface AttendanceResult {
    myRecord: AttendanceRecord | null
    allRecords: Map<string, AttendanceRecord>
    session: AttendanceSession | null
    livenessChallenge: LivenessChallenge | null
    livenessVerified: boolean
    faceApiReady: boolean
    enrollmentStatus: "idle" | "enrolling" | "enrolled" | "failed"
    startSession: (minimumPercent?: number) => void
    endSession: () => void
    enrollFace: () => Promise<void>
    triggerLivenessChallenge: () => void
    markManualAbsence: (targetUserId: string) => void
    getAttendanceReport: () => AttendanceExport
    exportCSV: () => void
    exportPDF: () => Promise<void>
    exportExcel: () => void
    presentCount: number
    absentCount: number
    classAvgPresence: number
}

// ── Main Hook ─────────────────────────────────────────────────────────────────

export function useAttendanceSystem({
    socket, userId, displayName, isHost, meetingId, mode,
    faceCount, blinkRate, headYaw, headPitch, faceDetected,
    faceLandmarks, videoRef,
}: UseAttendanceOptions): AttendanceResult {

    const [session, setSession] = useState<AttendanceSession | null>(null)
    const [allRecords, setAllRecords] = useState<Map<string, AttendanceRecord>>(new Map())
    const [livenessChallenge, setLivenessChallenge] = useState<LivenessChallenge | null>(null)
    const [livenessVerified, setLivenessVerified] = useState(false)
    const [faceApiReadyState, setFaceApiReadyState] = useState(false)
    const [enrollmentStatus, setEnrollmentStatus] = useState<"idle"|"enrolling"|"enrolled"|"failed">("idle")

    const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const currentAbsenceRef = useRef<AbsencePeriod | null>(null)
    const fpRef = useRef<string>("")

    // ── Load face-api.js on mount ──────────────────────────────────────────────
    useEffect(() => {
        loadFaceAPI().then(api => {
            if (api) setFaceApiReadyState(true)
        })
        getFingerprint().then(fp => { fpRef.current = fp })
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    setAllRecords(prev => {
                        const updated = new Map(prev)
                        const rec = updated.get(userId)
                        if (rec) {
                            rec.geolocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
                            updated.set(userId, { ...rec })
                        }
                        return updated
                    })
                },
                () => {},
                { timeout: 5000 }
            )
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Register own record when session starts ────────────────────────────────
    useEffect(() => {
        if (!session) return
        setAllRecords(prev => {
            if (prev.has(userId)) return prev
            const rec = makeRecord(userId, displayName)
            rec.deviceFingerprint = fpRef.current
            if (faceLandmarks && faceLandmarks.length > 0) {
                rec.mpEmbedding = mpEmbedFromLandmarks(faceLandmarks)
            }
            const updated = new Map(prev)
            updated.set(userId, rec)
            return updated
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session])

    // ── Face-api.js enrollment ─────────────────────────────────────────────────
    const enrollFace = useCallback(async () => {
        if (!videoRef?.current || !faceApiModule) return
        setEnrollmentStatus("enrolling")
        try {
            const detections = await faceApiModule
                .detectSingleFace(videoRef.current as HTMLVideoElement)
                .withFaceLandmarks()
                .withFaceDescriptor()

            if (!detections) {
                setEnrollmentStatus("failed")
                return
            }

            const descriptor = detections.descriptor  // Float32Array[128]
            setAllRecords(prev => {
                const updated = new Map(prev)
                const rec = updated.get(userId) || makeRecord(userId, displayName)
                rec.faceDescriptor = descriptor
                rec.verificationCount = 1
                rec.status = "present"
                updated.set(userId, { ...rec })
                return updated
            })
            setEnrollmentStatus("enrolled")
        } catch (err) {
            console.error("face-api.js enrollment failed:", err)
            setEnrollmentStatus("failed")
        }
    }, [videoRef, userId, displayName])

    // ── Periodic presence tick ─────────────────────────────────────────────────
    useEffect(() => {
        if (!session) return
        tickerRef.current = setInterval(async () => {
            const now = Date.now()
            const isPresent = faceDetected && faceCount === 1

            setAllRecords(prev => {
                const updated = new Map(prev)
                const rec = updated.get(userId)
                if (!rec) return prev

                if (isPresent) {
                    rec.presentDurationMs += 3000
                    rec.lastVerifiedAt = now
                    rec.status = "present"
                    if (currentAbsenceRef.current?.end === null) {
                        currentAbsenceRef.current.end = now
                        rec.absencePeriods.push({ ...currentAbsenceRef.current! })
                        currentAbsenceRef.current = null
                    }
                } else {
                    if (!currentAbsenceRef.current) {
                        currentAbsenceRef.current = {
                            start: now, end: null,
                            reason: faceCount > 1 ? "multiple_faces" : "no_face"
                        }
                        rec.status = faceCount > 1 ? "away" : "absent"
                    }
                }

                // Background face-api.js re-verification every 30s
                if (isPresent && now - rec.lastVerifiedAt > 30000 && videoRef?.current && faceApiModule && rec.faceDescriptor) {
                    const videoEl = videoRef.current as HTMLVideoElement
                    void faceApiModule.detectSingleFace(videoEl)
                        .withFaceLandmarks()
                        .withFaceDescriptor()
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .then((detection: any): any => {
                            if (!detection) return undefined
                            const dist = euclideanDist(rec.faceDescriptor!, detection.descriptor)
                            if (dist < 0.5) {
                                rec.verificationCount++
                                rec.verificationFailures = Math.max(0, rec.verificationFailures - 1)
                            } else {
                                rec.verificationFailures++
                                if (rec.verificationFailures >= 3) rec.status = "unverified"
                            }
                        }).catch(() => {})
                }

                // MediaPipe embedding fallback verification
                if (isPresent && !faceApiModule && faceLandmarks && faceLandmarks.length > 0 && rec.mpEmbedding) {
                    const currEmb = mpEmbedFromLandmarks(faceLandmarks)
                    const sim = cosineSim(rec.mpEmbedding, currEmb)
                    if (sim > 0.92) rec.verificationCount++
                    else rec.verificationFailures++
                }

                updated.set(userId, { ...rec })
                return updated
            })
        }, 3000)
        return () => { if (tickerRef.current) clearInterval(tickerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, faceDetected, faceCount, userId])

    // ── Liveness challenge verifier ────────────────────────────────────────────
    useEffect(() => {
        if (!livenessChallenge || livenessChallenge.passed) return
        if (Date.now() > livenessChallenge.expiresAt) return
        const { type } = livenessChallenge
        const passed =
            type === "blink" ? (blinkRate > 5 && blinkRate < 45) :
            type === "turn_left" ? headYaw < -15 :
            type === "turn_right" ? headYaw > 15 :
            type === "nod" ? Math.abs(headPitch) > 12 : false

        if (passed) {
            setLivenessVerified(true)
            setLivenessChallenge(prev => prev ? { ...prev, passed: true } : null)
            setAllRecords(prev => {
                const updated = new Map(prev)
                const rec = updated.get(userId)
                if (rec) { rec.livenessScore = Math.min(100, rec.livenessScore + 25); updated.set(userId, { ...rec }) }
                return updated
            })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blinkRate, headYaw, headPitch, livenessChallenge])

    // ── Socket events ──────────────────────────────────────────────────────────
    useEffect(() => {
        const s = socket as { on?: Function; off?: Function } | null
        if (!s?.on) return
        s.on("attendance:session-started", (data: AttendanceSession) => setSession(data))
        s.on("attendance:session-ended", () => setSession(s => s ? { ...s, endedAt: Date.now() } : null))
        s.on("attendance:update", (data: { userId: string; displayName: string; status: string; presentDurationMs: number }) => {
            setAllRecords(prev => {
                const updated = new Map(prev)
                const rec = updated.get(data.userId) || makeRecord(data.userId, data.displayName)
                rec.status = data.status as AttendanceRecord["status"]
                rec.presentDurationMs = data.presentDurationMs
                updated.set(data.userId, rec)
                return updated
            })
        })
        return () => { s.off?.("attendance:session-started"); s.off?.("attendance:session-ended"); s.off?.("attendance:update") }
    }, [socket])

    // ── Actions ────────────────────────────────────────────────────────────────

    const startSession = useCallback((minimumPercent = 75) => {
        if (!isHost) return
        const s: AttendanceSession = {
            meetingId, hostId: userId, startedAt: Date.now(),
            endedAt: null, mode: "face", minimumPresentPercent: minimumPercent
        }
        setSession(s)
        ;(socket as { emit?: Function } | null)?.emit?.("attendance:start-session", { meetingId, minimumPercent })
    }, [isHost, meetingId, socket, userId])

    const endSession = useCallback(() => {
        if (!isHost) return
        setSession(prev => prev ? { ...prev, endedAt: Date.now() } : null)
        ;(socket as { emit?: Function } | null)?.emit?.("attendance:end-session", { meetingId })
    }, [isHost, meetingId, socket])

    const markManualAbsence = useCallback((targetUserId: string) => {
        if (!isHost) return
        setAllRecords(prev => {
            const updated = new Map(prev)
            const rec = updated.get(targetUserId)
            if (rec) { rec.status = "absent"; updated.set(targetUserId, { ...rec }) }
            return updated
        })
    }, [isHost])

    const triggerLivenessChallenge = useCallback(() => {
        const types: LivenessChallenge["type"][] = ["blink", "turn_left", "turn_right", "nod"]
        setLivenessChallenge({
            type: types[Math.floor(Math.random() * types.length)],
            issued: true, passed: false, expiresAt: Date.now() + 8000
        })
        setLivenessVerified(false)
    }, [])

    // ── Report helpers ─────────────────────────────────────────────────────────

    const sessionDuration = session ? (session.endedAt || Date.now()) - session.startedAt : 0

    const getAttendanceReport = useCallback((): AttendanceExport => {
        const minPct = session?.minimumPresentPercent ?? 75
        const records: AttendanceExportRow[] = Array.from(allRecords.values()).map(rec => {
            const presentPct = sessionDuration > 0 ? Math.round((rec.presentDurationMs / sessionDuration) * 100) : 0
            const result: "PASS"|"FAIL"|"PARTIAL" = presentPct >= minPct && rec.livenessScore >= 50 ? "PASS"
                : presentPct < 50 ? "FAIL" : "PARTIAL"
            return {
                name: rec.displayName, userId: rec.userId, status: rec.status,
                joinedAt: new Date(rec.joinedAt).toLocaleString(),
                presentDuration: formatDur(rec.presentDurationMs),
                presentPercent: presentPct, livenessScore: rec.livenessScore,
                verifications: rec.verificationCount, failures: rec.verificationFailures, result,
            }
        })
        const passed = records.filter(r => r.result === "PASS").length
        const partial = records.filter(r => r.result === "PARTIAL").length
        const failed = records.filter(r => r.result === "FAIL").length
        const avg = records.length > 0 ? Math.round(records.reduce((a,r) => a + r.presentPercent, 0) / records.length) : 0
        return {
            meetingId, generatedAt: new Date().toLocaleString(),
            duration: formatDur(sessionDuration), totalParticipants: records.length,
            minimumRequiredPercent: minPct, records,
            summary: { passed, failed, partial, averagePresence: avg }
        }
    }, [allRecords, session, sessionDuration, meetingId])

    const exportCSV = useCallback(() => {
        const report = getAttendanceReport()
        const headers = ["Name","Status","Joined At","Present Duration","Present %","Liveness Score","Verifications","Failures","Result"]
        const rows = report.records.map(r => [r.name, r.status, r.joinedAt, r.presentDuration, `${r.presentPercent}%`, r.livenessScore, r.verifications, r.failures, r.result])
        const csv = [headers, ...rows].map(row => `"${row.join('","')}"`).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = `Attendance_${meetingId}.csv`; a.click()
        URL.revokeObjectURL(url)
    }, [getAttendanceReport, meetingId])

    const exportPDF = useCallback(async () => {
        const report = getAttendanceReport()
        try {
            const { jsPDF } = await import("jspdf")
            const { default: autoTable } = await import("jspdf-autotable")
            const doc = new jsPDF()

            // Header
            doc.setFontSize(20); doc.setTextColor(124, 58, 237)
            doc.text("Attendance Report", 14, 20)
            doc.setFontSize(10); doc.setTextColor(100, 100, 100)
            doc.text(`Meeting ID: ${report.meetingId}`, 14, 30)
            doc.text(`Generated: ${report.generatedAt}`, 14, 36)
            doc.text(`Duration: ${report.duration}`, 14, 42)
            doc.text(`Minimum Required: ${report.minimumRequiredPercent}%`, 14, 48)

            // Summary boxes
            doc.setFontSize(12); doc.setTextColor(0, 0, 0)
            doc.text(`✅ Passed: ${report.summary.passed}   ❌ Failed: ${report.summary.failed}   ~ Partial: ${report.summary.partial}   Avg: ${report.summary.averagePresence}%`, 14, 58)

            // Table
            autoTable(doc, {
                startY: 68,
                head: [["Name", "Status", "Present %", "Liveness", "Verifications", "Failures", "Result"]],
                body: report.records.map(r => [r.name, r.status, `${r.presentPercent}%`, `${r.livenessScore}%`, r.verifications, r.failures, r.result]),
                headStyles: { fillColor: [124, 58, 237] },
                alternateRowStyles: { fillColor: [248, 246, 255] },
                styles: { fontSize: 9 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                didDrawCell: (data: any) => {
                    if (data.section === "body" && data.column.index === 6) {
                        const val = data.cell.raw as string
                        data.cell.styles.textColor = val === "PASS" ? [22, 163, 74] : val === "FAIL" ? [220, 38, 38] : [217, 119, 6]
                    }
                }
            })

            doc.save(`Attendance_${meetingId}_${new Date().toISOString().slice(0,10)}.pdf`)
        } catch (err) {
            console.error("PDF export failed:", err)
        }
    }, [getAttendanceReport, meetingId])

    const exportExcel = useCallback(() => {
        const report = getAttendanceReport()
        try {
            // Dynamic import
            import("xlsx").then(XLSX => {
                const ws = XLSX.utils.json_to_sheet(report.records)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "Attendance")
                // Summary sheet
                const summaryData = [
                    { Metric: "Meeting ID", Value: report.meetingId },
                    { Metric: "Generated At", Value: report.generatedAt },
                    { Metric: "Duration", Value: report.duration },
                    { Metric: "Total Participants", Value: report.totalParticipants },
                    { Metric: "Minimum Required %", Value: report.minimumRequiredPercent },
                    { Metric: "Passed", Value: report.summary.passed },
                    { Metric: "Failed", Value: report.summary.failed },
                    { Metric: "Partial", Value: report.summary.partial },
                    { Metric: "Average Presence %", Value: report.summary.averagePresence },
                ]
                const ws2 = XLSX.utils.json_to_sheet(summaryData)
                XLSX.utils.book_append_sheet(wb, ws2, "Summary")
                XLSX.writeFile(wb, `Attendance_${meetingId}_${new Date().toISOString().slice(0,10)}.xlsx`)
            })
        } catch (err) {
            console.error("Excel export failed:", err)
        }
    }, [getAttendanceReport, meetingId])

    // ── Derived ────────────────────────────────────────────────────────────────

    const records = Array.from(allRecords.values())
    const presentCount = records.filter(r => r.status === "present").length
    const absentCount = records.filter(r => r.status === "absent").length
    const classAvgPresence = records.length > 0 && sessionDuration > 0
        ? Math.round(records.reduce((a, r) => a + (r.presentDurationMs / sessionDuration * 100), 0) / records.length)
        : 0

    return {
        myRecord: allRecords.get(userId) ?? null,
        allRecords, session, livenessChallenge, livenessVerified,
        faceApiReady: faceApiReadyState, enrollmentStatus,
        startSession, endSession, enrollFace, triggerLivenessChallenge,
        markManualAbsence, getAttendanceReport, exportCSV, exportPDF, exportExcel,
        presentCount, absentCount, classAvgPresence,
    }
}
