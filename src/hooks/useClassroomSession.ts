"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface StudentAttention {
  userId: string
  displayName: string
  attentionScore: number       // 0-100
  gazeScore: number           // 0-100
  facePresent: boolean
  lastSeen: number            // timestamp
  handRaised: boolean
  quizAnswers: Record<string, string>  // questionId -> answer
  violations: string[]        // list of violation messages
  joinedAt: number
  disconnectedAt?: number
}

export interface QuizQuestion {
  id: string
  text: string
  options: string[]
  correctAnswer: string
  timeLimit?: number  // seconds
}

export interface QuizResult {
  questionId: string
  answers: Record<string, string>  // userId -> answer
  correctCount: number
  totalCount: number
  averageTimeMs: number
}

export interface ClassroomSession {
  mode: "waiting" | "lecture" | "quiz" | "ended"
  startedAt: number | null
  currentTopic?: string
  students: Map<string, StudentAttention>
  activeQuiz?: QuizQuestion
  quizResults: QuizResult[]
  lessonNotes: string[]
}

// ─────────────────────────────────────────────
// Demo data helpers
// ─────────────────────────────────────────────

const DEMO_NAMES = [
  "Alice Johnson",
  "Bob Martinez",
  "Charlie Kim",
  "Diana Patel",
]

function makeDemoStudent(index: number, now: number): StudentAttention {
  return {
    userId: `demo-student-${index}`,
    displayName: DEMO_NAMES[index] ?? `Student ${index + 1}`,
    attentionScore: Math.floor(Math.random() * 101),
    gazeScore: Math.floor(Math.random() * 101),
    facePresent: Math.random() > 0.2,
    lastSeen: now,
    handRaised: Math.random() > 0.75,
    quizAnswers: {},
    violations: [],
    joinedAt: now - Math.floor(Math.random() * 600_000),
  }
}

function buildDemoStudents(): Map<string, StudentAttention> {
  const now = Date.now()
  const map = new Map<string, StudentAttention>()
  for (let i = 0; i < 4; i++) {
    const s = makeDemoStudent(i, now)
    map.set(s.userId, s)
  }
  return map
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useClassroomSession(
  socket: any,
  userId: string,
  isHost: boolean
) {
  const isDemo = socket === null || socket === undefined

  const [session, setSession] = useState<ClassroomSession>(() => ({
    mode: isDemo ? "lecture" : "waiting",
    startedAt: isDemo ? Date.now() : null,
    currentTopic: isDemo ? "Demo Lesson" : undefined,
    students: isDemo ? buildDemoStudents() : new Map(),
    activeQuiz: undefined,
    quizResults: [],
    lessonNotes: [],
  }))

  const sessionRef = useRef(session)
  sessionRef.current = session

  // Demo mode: randomise scores every 3 s
  useEffect(() => {
    if (!isDemo) return
    const id = setInterval(() => {
      setSession((prev) => {
        const updated = new Map(prev.students)
        updated.forEach((student, key) => {
          const delta = () => Math.floor((Math.random() - 0.5) * 20)
          updated.set(key, {
            ...student,
            attentionScore: Math.min(100, Math.max(0, student.attentionScore + delta())),
            gazeScore: Math.min(100, Math.max(0, student.gazeScore + delta())),
            facePresent: Math.random() > 0.15,
            lastSeen: Date.now(),
          })
        })
        return { ...prev, students: updated }
      })
    }, 3_000)
    return () => clearInterval(id)
  }, [isDemo])

  // Socket event listeners
  useEffect(() => {
    if (isDemo || !socket) return

    const onJoin = (data: { userId: string; displayName: string; joinedAt: number }) => {
      setSession((prev) => {
        const students = new Map(prev.students)
        const existing = students.get(data.userId)
        students.set(data.userId, {
          userId: data.userId,
          displayName: data.displayName,
          attentionScore: existing?.attentionScore ?? 100,
          gazeScore: existing?.gazeScore ?? 100,
          facePresent: true,
          lastSeen: Date.now(),
          handRaised: existing?.handRaised ?? false,
          quizAnswers: existing?.quizAnswers ?? {},
          violations: existing?.violations ?? [],
          joinedAt: data.joinedAt,
          disconnectedAt: undefined,
        })
        return {
          ...prev,
          mode: prev.mode === "waiting" ? "lecture" : prev.mode,
          startedAt: prev.startedAt ?? Date.now(),
          students,
        }
      })
    }

    const onAttentionUpdate = (data: {
      userId: string
      attentionScore: number
      gazeScore: number
      facePresent: boolean
    }) => {
      setSession((prev) => {
        const students = new Map(prev.students)
        const s = students.get(data.userId)
        if (!s) return prev
        students.set(data.userId, {
          ...s,
          attentionScore: data.attentionScore,
          gazeScore: data.gazeScore,
          facePresent: data.facePresent,
          lastSeen: Date.now(),
        })
        return { ...prev, students }
      })
    }

    const onQuizAnswer = (data: { userId: string; questionId: string; answer: string }) => {
      setSession((prev) => {
        const students = new Map(prev.students)
        const s = students.get(data.userId)
        if (!s) return prev
        students.set(data.userId, {
          ...s,
          quizAnswers: { ...s.quizAnswers, [data.questionId]: data.answer },
        })
        const quizResults = [...prev.quizResults]
        const idx = quizResults.findIndex((r) => r.questionId === data.questionId)
        const activeQ = prev.activeQuiz
        if (activeQ && activeQ.id === data.questionId) {
          const answers: Record<string, string> = {}
          students.forEach((st) => {
            if (st.quizAnswers[data.questionId]) {
              answers[st.userId] = st.quizAnswers[data.questionId]
            }
          })
          const correctCount = Object.values(answers).filter((a) => a === activeQ.correctAnswer).length
          const entry: QuizResult = {
            questionId: data.questionId,
            answers,
            correctCount,
            totalCount: Object.keys(answers).length,
            averageTimeMs: 0,
          }
          if (idx === -1) quizResults.push(entry)
          else quizResults[idx] = entry
        }
        return { ...prev, students, quizResults }
      })
    }

    const onHandRaise = ({ userId: uid }: { userId: string }) => {
      setSession((prev) => {
        const students = new Map(prev.students)
        const s = students.get(uid)
        if (!s) return prev
        students.set(uid, { ...s, handRaised: true })
        return { ...prev, students }
      })
    }

    const onHandLower = ({ userId: uid }: { userId: string }) => {
      setSession((prev) => {
        const students = new Map(prev.students)
        const s = students.get(uid)
        if (!s) return prev
        students.set(uid, { ...s, handRaised: false })
        return { ...prev, students }
      })
    }

    socket.on("classroom:join", onJoin)
    socket.on("classroom:attention-update", onAttentionUpdate)
    socket.on("classroom:quiz-answer", onQuizAnswer)
    socket.on("classroom:hand-raise", onHandRaise)
    socket.on("classroom:hand-lower", onHandLower)

    return () => {
      socket.off("classroom:join", onJoin)
      socket.off("classroom:attention-update", onAttentionUpdate)
      socket.off("classroom:quiz-answer", onQuizAnswer)
      socket.off("classroom:hand-raise", onHandRaise)
      socket.off("classroom:hand-lower", onHandLower)
    }
  }, [isDemo, socket])

  // ── Actions ────────────────────────────────────────────────────────────

  const launchQuiz = useCallback(
    (questions: QuizQuestion[]) => {
      if (!questions.length) return
      const q = questions[0]
      setSession((prev) => ({ ...prev, mode: "quiz", activeQuiz: q }))
      if (!isDemo && socket) socket.emit("classroom:launch-quiz", { question: q })
    },
    [isDemo, socket]
  )

  const endQuiz = useCallback(() => {
    setSession((prev) => ({ ...prev, mode: "lecture", activeQuiz: undefined }))
    if (!isDemo && socket) socket.emit("classroom:end-quiz", {})
  }, [isDemo, socket])

  const addNote = useCallback(
    (text: string) => {
      const stamped = `[${new Date().toLocaleTimeString()}] ${text}`
      setSession((prev) => ({ ...prev, lessonNotes: [...prev.lessonNotes, stamped] }))
      if (!isDemo && socket) socket.emit("classroom:add-note", { text: stamped })
    },
    [isDemo, socket]
  )

  const updateMyAttention = useCallback(
    (score: number, gazeScore: number, facePresent: boolean) => {
      if (isHost) return
      if (!isDemo && socket) {
        socket.emit("classroom:attention-update", { userId, attentionScore: score, gazeScore, facePresent })
      }
    },
    [isDemo, isHost, socket, userId]
  )

  const getReportData = useCallback(() => {
    const s = sessionRef.current
    const studentsArr = Array.from(s.students.values()).map((st) => ({
      ...st,
      quizAnswers: { ...st.quizAnswers },
      violations: [...st.violations],
    }))
    const scores = studentsArr.map((st) => st.attentionScore)
    const avgAttention =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    return {
      sessionMode: s.mode,
      startedAt: s.startedAt,
      generatedAt: Date.now(),
      currentTopic: s.currentTopic,
      averageAttention: avgAttention,
      totalStudents: studentsArr.length,
      handsRaisedCount: studentsArr.filter((st) => st.handRaised).length,
      students: studentsArr,
      quizResults: s.quizResults,
      lessonNotes: s.lessonNotes,
    }
  }, [])

  return { session, launchQuiz, endQuiz, addNote, updateMyAttention, getReportData }
}
