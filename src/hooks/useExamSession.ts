"use client"

import { useState, useCallback, useEffect, useRef } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────────────────────────

export type ExamState = 'waiting' | 'active' | 'submitted' | 'reviewing'

export interface ExamQuestion {
    id: string
    text: string
    type: 'mcq' | 'short_answer' | 'essay'
    options?: string[]          // MCQ only
    correctAnswer?: string      // for MCQ auto-grading
    marks: number
    timeLimit?: number          // per-question time limit in seconds
}

export interface StudentViolation {
    studentId: string
    displayName: string
    timestamp: number
    type: 'tab_switch' | 'second_face' | 'phone_detected' | 'left_frame' | 'eye_movement' | 'fullscreen_exit'
    description: string
}

export interface StudentExamStatus {
    userId: string
    displayName: string
    state: ExamState
    answeredCount: number
    totalQuestions: number
    violations: StudentViolation[]
    submittedAt?: number
    score?: number
    plagiarismRisk?: number
}

export interface ExamAnswers {
    [questionId: string]: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo-Mode Data
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_QUESTIONS: ExamQuestion[] = [
    {
        id: "dq-1",
        text: "Which data structure operates on a Last-In, First-Out (LIFO) principle?",
        type: "mcq",
        options: ["Queue", "Stack", "Linked List", "Binary Tree"],
        correctAnswer: "Stack",
        marks: 10,
        timeLimit: 90,
    },
    {
        id: "dq-2",
        text: "What is the time complexity of binary search on a sorted array of n elements?",
        type: "mcq",
        options: ["O(n)", "O(n\u00b2)", "O(log n)", "O(1)"],
        correctAnswer: "O(log n)",
        marks: 10,
    },
    {
        id: "dq-3",
        text: "Briefly explain the difference between a process and a thread in an operating system context.",
        type: "short_answer",
        marks: 20,
        timeLimit: 300,
    },
]

const DEMO_STUDENTS: StudentExamStatus[] = [
    {
        userId: "student-demo-1",
        displayName: "Alice Johnson",
        state: "active",
        answeredCount: 2,
        totalQuestions: 3,
        violations: [
            {
                studentId: "student-demo-1",
                displayName: "Alice Johnson",
                timestamp: Date.now() - 120_000,
                type: "tab_switch",
                description: "Student switched to another browser tab",
            },
        ],
        plagiarismRisk: 12,
    },
    {
        userId: "student-demo-2",
        displayName: "Bob Martinez",
        state: "active",
        answeredCount: 1,
        totalQuestions: 3,
        violations: [
            {
                studentId: "student-demo-2",
                displayName: "Bob Martinez",
                timestamp: Date.now() - 65_000,
                type: "second_face",
                description: "Second person detected in camera frame",
            },
            {
                studentId: "student-demo-2",
                displayName: "Bob Martinez",
                timestamp: Date.now() - 30_000,
                type: "eye_movement",
                description: "Excessive off-screen eye movement detected",
            },
        ],
        plagiarismRisk: 28,
    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Hook Return Type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseExamSessionReturn {
    examState: ExamState
    questions: ExamQuestion[]
    answers: ExamAnswers
    studentStatuses: Map<string, StudentExamStatus>
    violations: StudentViolation[]
    examTimeRemaining: number
    setAnswer: (questionId: string, answer: string) => void
    submitExam: () => void
    startExam: (questions: ExamQuestion[], durationMinutes: number) => void
    endExam: () => void
    reportViolation: (type: StudentViolation['type'], description: string) => void
    getGradedResults: () => { studentId: string; score: number; total: number; percentage: number }[]
    detectTabSwitch: () => () => void
    detectFullscreenExit: () => () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function computePlagiarismRisk(_answers: ExamAnswers): number {
    // Production: compare against a stored answer corpus with similarity scoring.
    // For now: lightweight random 0-30 % signal as a placeholder.
    return Math.floor(Math.random() * 30)
}

function autoGradeMCQ(questions: ExamQuestion[], answers: ExamAnswers): number {
    return questions.reduce((score, q) => {
        if (q.type !== "mcq" || !q.correctAnswer) return score
        return answers[q.id] === q.correctAnswer ? score + q.marks : score
    }, 0)
}

function totalMarks(questions: ExamQuestion[]): number {
    return questions.reduce((acc, q) => acc + q.marks, 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useExamSession(
    socket: any,
    userId: string,
    isHost: boolean,
): UseExamSessionReturn {
    const isDemoMode = socket === null

    // ── Core state ────────────────────────────────────────────────────────────
    const [examState, setExamState] = useState<ExamState>("waiting")
    const [questions, setQuestions] = useState<ExamQuestion[]>(
        isDemoMode ? DEMO_QUESTIONS : [],
    )
    const [answers, setAnswers] = useState<ExamAnswers>({})
    const [violations, setViolations] = useState<StudentViolation[]>(
        isDemoMode && isHost
            ? DEMO_STUDENTS.flatMap(s => s.violations)
            : [],
    )
    const [examTimeRemaining, setExamTimeRemaining] = useState<number>(0)
    const [studentStatuses, setStudentStatuses] = useState<Map<string, StudentExamStatus>>(
        () => {
            if (isDemoMode && isHost) {
                const m = new Map<string, StudentExamStatus>()
                DEMO_STUDENTS.forEach(s => m.set(s.userId, s))
                return m
            }
            return new Map()
        },
    )

    // ── Refs ──────────────────────────────────────────────────────────────────
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const examEndAtRef = useRef<number>(0)
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const violationDebounceRef = useRef<Partial<Record<StudentViolation['type'], number>>>({})

    // ── Demo-mode: seed with "active" state so host sees content immediately ──
    useEffect(() => {
        if (!isDemoMode || !isHost) return
        setExamState("active")
        examEndAtRef.current = Date.now() + 45 * 60 * 1000
        setExamTimeRemaining(45 * 60)
        timerRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.floor((examEndAtRef.current - Date.now()) / 1000))
            setExamTimeRemaining(remaining)
            if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current)
        }, 1000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [isDemoMode, isHost])

    // ─────────────────────────────────────────────────────────────────────────
    // Socket event listeners
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return

        // Student receives: exam started
        socket.on("exam:start", ({
            questions: qs,
            durationSeconds,
            endAt,
        }: { questions: ExamQuestion[]; durationSeconds: number; endAt: number }) => {
            setQuestions(qs)
            setExamState("active")
            examEndAtRef.current = endAt
            setExamTimeRemaining(durationSeconds)
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = setInterval(() => {
                const remaining = Math.max(0, Math.floor((examEndAtRef.current - Date.now()) / 1000))
                setExamTimeRemaining(remaining)
                if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current)
            }, 1000)
        })

        // Time-sync correction from host
        socket.on("exam:time-sync", ({ endAt }: { endAt: number }) => {
            examEndAtRef.current = endAt
        })

        // Host receives: student answer progress
        socket.on("exam:answer", ({
            studentId, displayName, answeredCount,
        }: { studentId: string; displayName: string; answeredCount: number }) => {
            setStudentStatuses(prev => {
                const next = new Map(prev)
                const existing = next.get(studentId) ?? {
                    userId: studentId, displayName,
                    state: "active" as ExamState,
                    answeredCount: 0,
                    totalQuestions: questions.length,
                    violations: [],
                }
                next.set(studentId, { ...existing, answeredCount })
                return next
            })
        })

        // Host receives: student submitted
        socket.on("exam:submit", ({
            studentId, displayName, answers: studentAnswers, timestamp,
        }: { studentId: string; displayName: string; answers: ExamAnswers; timestamp: number }) => {
            setStudentStatuses(prev => {
                const next = new Map(prev)
                const existing = next.get(studentId)
                const score = autoGradeMCQ(questions, studentAnswers)
                next.set(studentId, {
                    ...(existing ?? {
                        userId: studentId, displayName,
                        state: "submitted" as ExamState,
                        answeredCount: 0,
                        totalQuestions: questions.length,
                        violations: [],
                    }),
                    state: "submitted",
                    answeredCount: Object.keys(studentAnswers).length,
                    submittedAt: timestamp,
                    score,
                    plagiarismRisk: computePlagiarismRisk(studentAnswers),
                })
                return next
            })
        })

        // Host receives: violation
        socket.on("exam:violation", (violation: StudentViolation) => {
            setViolations(prev => [violation, ...prev].slice(0, 500))
            setStudentStatuses(prev => {
                const next = new Map(prev)
                const existing = next.get(violation.studentId)
                if (!existing) return prev
                next.set(violation.studentId, {
                    ...existing,
                    violations: [violation, ...existing.violations].slice(0, 100),
                })
                return next
            })
        })

        // All participants: exam ended
        socket.on("exam:end", () => {
            if (timerRef.current) clearInterval(timerRef.current)
            setExamState("reviewing")
            setExamTimeRemaining(0)
        })

        // Student joining mid-exam
        socket.on("exam:state", ({
            questions: qs, endAt, state,
        }: { questions: ExamQuestion[]; endAt: number; state: ExamState }) => {
            setQuestions(qs)
            setExamState(state)
            if (state === "active") {
                examEndAtRef.current = endAt
                setExamTimeRemaining(Math.max(0, Math.floor((endAt - Date.now()) / 1000)))
            }
        })

        return () => {
            socket.off("exam:start")
            socket.off("exam:time-sync")
            socket.off("exam:answer")
            socket.off("exam:submit")
            socket.off("exam:violation")
            socket.off("exam:end")
            socket.off("exam:state")
        }
    }, [socket, questions])

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
        }
    }, [])

    // ─────────────────────────────────────────────────────────────────────────
    // Violation reporting — debounced 10 s per type
    // ─────────────────────────────────────────────────────────────────────────

    const reportViolation = useCallback((
        type: StudentViolation['type'],
        description: string,
    ) => {
        const now = Date.now()
        const last = violationDebounceRef.current[type] ?? 0
        if (now - last < 10_000) return
        violationDebounceRef.current[type] = now

        const violation: StudentViolation = {
            studentId: userId,
            displayName: "You",
            timestamp: now,
            type,
            description,
        }
        setViolations(prev => [violation, ...prev].slice(0, 500))
        if (socket) socket.emit("exam:violation", violation)
    }, [socket, userId])

    // ─────────────────────────────────────────────────────────────────────────
    // Tab-switch detection — returns cleanup function
    // ─────────────────────────────────────────────────────────────────────────

    const detectTabSwitch = useCallback((): (() => void) => {
        const handler = () => {
            if (document.hidden) {
                reportViolation("tab_switch", "Student switched to another browser tab or minimized the window")
            }
        }
        document.addEventListener("visibilitychange", handler)
        return () => document.removeEventListener("visibilitychange", handler)
    }, [reportViolation])

    // ─────────────────────────────────────────────────────────────────────────
    // Fullscreen-exit detection — returns cleanup function
    // ─────────────────────────────────────────────────────────────────────────

    const detectFullscreenExit = useCallback((): (() => void) => {
        const handleChange = () => {
            if (!document.fullscreenElement) {
                reportViolation("fullscreen_exit", "Student exited fullscreen mode during the exam")
            }
        }
        document.addEventListener("fullscreenchange", handleChange)
        return () => document.removeEventListener("fullscreenchange", handleChange)
    }, [reportViolation])

    // ─────────────────────────────────────────────────────────────────────────
    // setAnswer
    // ─────────────────────────────────────────────────────────────────────────

    const setAnswer = useCallback((questionId: string, answer: string) => {
        setAnswers(prev => {
            const next = { ...prev, [questionId]: answer }
            if (socket) {
                socket.emit("exam:answer", {
                    studentId: userId,
                    questionId,
                    answeredCount: Object.keys(next).length,
                })
            }
            return next
        })
    }, [socket, userId])

    // ─────────────────────────────────────────────────────────────────────────
    // submitExam
    // ─────────────────────────────────────────────────────────────────────────

    const submitExam = useCallback(() => {
        if (examState !== "active") return
        setExamState("submitted")
        if (timerRef.current) clearInterval(timerRef.current)
        if (socket) {
            socket.emit("exam:submit", {
                studentId: userId,
                answers,
                timestamp: Date.now(),
            })
        }
    }, [examState, socket, userId, answers])

    // ─────────────────────────────────────────────────────────────────────────
    // startExam — host only
    // ─────────────────────────────────────────────────────────────────────────

    const startExam = useCallback((qs: ExamQuestion[], durationMinutes: number) => {
        if (!isHost) return
        const durationSeconds = durationMinutes * 60
        const endAt = Date.now() + durationSeconds * 1000

        setQuestions(qs)
        setExamState("active")
        examEndAtRef.current = endAt
        setExamTimeRemaining(durationSeconds)
        setStudentStatuses(new Map())

        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.floor((examEndAtRef.current - Date.now()) / 1000))
            setExamTimeRemaining(remaining)
            if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current)
        }, 1000)

        if (socket) {
            socket.emit("exam:start", { questions: qs, durationSeconds, endAt })
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
            syncIntervalRef.current = setInterval(() => {
                socket.emit("exam:time-sync", { endAt: examEndAtRef.current })
            }, 30_000)
        }
    }, [isHost, socket])

    // ─────────────────────────────────────────────────────────────────────────
    // endExam — host only
    // ─────────────────────────────────────────────────────────────────────────

    const endExam = useCallback(() => {
        if (!isHost) return
        if (timerRef.current) clearInterval(timerRef.current)
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
        setExamState("reviewing")
        setExamTimeRemaining(0)
        if (socket) socket.emit("exam:end", {})

        // Auto-assign 0 to students who never submitted
        setStudentStatuses(prev => {
            const next = new Map(prev)
            next.forEach((status, key) => {
                if (status.score === undefined) {
                    next.set(key, {
                        ...status,
                        score: 0,
                        plagiarismRisk: computePlagiarismRisk({}),
                    })
                }
            })
            return next
        })
    }, [isHost, socket])

    // ─────────────────────────────────────────────────────────────────────────
    // getGradedResults
    // ─────────────────────────────────────────────────────────────────────────

    const getGradedResults = useCallback((): {
        studentId: string; score: number; total: number; percentage: number
    }[] => {
        const total = totalMarks(questions)
        const results: { studentId: string; score: number; total: number; percentage: number }[] = []
        studentStatuses.forEach(status => {
            const score = status.score ?? 0
            results.push({
                studentId: status.userId,
                score,
                total,
                percentage: total > 0 ? Math.round((score / total) * 100) : 0,
            })
        })
        return results.sort((a, b) => b.percentage - a.percentage)
    }, [studentStatuses, questions])

    // ─────────────────────────────────────────────────────────────────────────
    // Return
    // ─────────────────────────────────────────────────────────────────────────

    return {
        examState,
        questions,
        answers,
        studentStatuses,
        violations,
        examTimeRemaining,
        setAnswer,
        submitExam,
        startExam,
        endExam,
        reportViolation,
        getGradedResults,
        detectTabSwitch,
        detectFullscreenExit,
    }
}
