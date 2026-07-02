import os

path = r'c:\Users\DELL\OneDrive\Desktop\meet-clone\src\app\meet\[id]\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'import EngagementPanel from "@/components/EngagementPanel"',
    'import EngagementPanel from "@/components/EngagementPanel"\nimport ModeSelectionScreen from "@/components/ModeSelectionScreen"\nimport ClassroomDashboard from "@/components/ClassroomDashboard"\nimport InterviewerDashboard from "@/components/InterviewerDashboard"\nimport InvigilatorDashboard from "@/components/InvigilatorDashboard"\nimport ExamStudentView from "@/components/ExamStudentView"\nimport { useClassroomSession } from "@/hooks/useClassroomSession"\nimport { useInterviewSession } from "@/hooks/useInterviewSession"\nimport { useExamSession } from "@/hooks/useExamSession"'
)

# 2. Type definitions
content = content.replace(
    "type SidebarTab = 'scam' | 'notify' | 'graph' | 'chat' | 'participants' | 'polls' | 'breakout' | 'exam' | 'wiki' | 'engagement'",
    "type SidebarTab = 'scam' | 'notify' | 'graph' | 'chat' | 'participants' | 'polls' | 'breakout' | 'exam' | 'wiki' | 'engagement' | 'classroom' | 'interview' | 'exam_panel'\ntype RoomMode = 'office' | 'classroom' | 'interview' | 'exam' | null"
)

# 3. roomMode state
content = content.replace(
    'const [elapsed, setElapsed] = useState("0:00")',
    'const [elapsed, setElapsed] = useState("0:00")\n    const [roomMode, setRoomMode] = useState<RoomMode>(null)'
)

# 4. Mode hooks
content = content.replace(
    '// ── Chat ──────────────────────────────────────────────────────────────────\n    const chat = useChat(socket, userId, displayName)',
    '''// ── Session Modes Hooks ───────────────────────────────────────────────────
    const classroom = useClassroomSession(socket, userId, isHost)
    const interview = useInterviewSession({
        socket, userId, isHost,
        eyeContactScore: gaze.gazeAttentionScore,
        stressLevel: stressVoice.stressLevel,
        isSpeaking: stressVoice.isSpeaking
    })
    const exam = useExamSession(socket, userId, isHost)

    // ── Chat ──────────────────────────────────────────────────────────────────
    const chat = useChat(socket, userId, displayName)'''
)

# 5. Render mode selection
content = content.replace(
    'if (!mounted) return null',
    '''useEffect(() => {
        if (!socket) return
        socket.on("mode-select", (mode: any) => setRoomMode(mode))
        return () => { socket.off("mode-select") }
    }, [socket])

    if (!mounted) return null

    if (roomMode === null) {
        return <ModeSelectionScreen 
            meetingId={meetingId}
            displayName={displayName}
            isHost={isHost}
            onSelectMode={(mode) => {
                setRoomMode(mode)
                if (socket) socket.emit("mode-select", mode)
            }}
            onSkip={() => setRoomMode('office')}
        />
    }'''
)

# 6. Sidebar tabs
content = content.replace(
    '''{[
                            { key: 'scam', icon: '🛡️', label: 'AI Fraud' },
                            { key: 'notify', icon: '🔔', label: 'Alerts' },
                            { key: 'graph', icon: '🕸️', label: 'Network' },
                            { key: 'engagement', icon: '📈', label: 'Engagement' },
                            { key: 'chat', icon: '💬', label: 'Chat' },
                            { key: 'participants', icon: '👥', label: 'People' },
                            { key: 'polls', icon: '📊', label: 'Polls' },
                            { key: 'breakout', icon: '🚪', label: 'Rooms' },
                            { key: 'wiki', icon: '📝', label: 'Notes' },
                            { key: 'exam', icon: '🎓', label: 'Exam' },
                        ].map(tab => (''',
    '''{[
                            { key: 'scam', icon: '🛡️', label: 'AI Fraud' },
                            ...(roomMode === 'classroom' ? [{ key: 'classroom' as SidebarTab, icon: '🏫', label: 'Classroom' }] : []),
                            ...(roomMode === 'interview' ? [{ key: 'interview' as SidebarTab, icon: '🎙️', label: 'Interview' }] : []),
                            ...(roomMode === 'exam' ? [{ key: 'exam_panel' as SidebarTab, icon: '📝', label: 'Invigilator' }] : []),
                            { key: 'notify', icon: '🔔', label: 'Alerts' },
                            { key: 'engagement', icon: '📈', label: 'Engagement' },
                            { key: 'chat', icon: '💬', label: 'Chat' },
                            { key: 'participants', icon: '👥', label: 'People' },
                            { key: 'wiki', icon: '📝', label: 'Notes' },
                        ].map(tab => ('''
)

# 7. Sidebar rendering panels
content = content.replace(
    '''{activeSidebarTab === 'chat' && (''',
    '''{activeSidebarTab === 'classroom' && roomMode === 'classroom' && (
                            <ClassroomDashboard 
                                isHost={isHost} userId={userId} displayName={displayName} 
                                session={classroom.session} launchQuiz={classroom.launchQuiz} 
                                endQuiz={classroom.endQuiz} addNote={classroom.addNote} 
                                getReportData={classroom.getReportData} transcript={whisper.transcriptText} 
                            />
                        )}
                        {activeSidebarTab === 'interview' && roomMode === 'interview' && (
                            <InterviewerDashboard 
                                isHost={isHost} metrics={interview.metrics} flags={interview.flags} 
                                notes={interview.notes} interviewDuration={interview.interviewDuration} 
                                addFlag={interview.addFlag} addNote={interview.addNote} 
                                removeFlag={interview.removeFlag} getReportData={interview.getReportData} 
                                transcript={whisper.transcriptText} 
                            />
                        )}
                        {activeSidebarTab === 'exam_panel' && roomMode === 'exam' && isHost && (
                            <InvigilatorDashboard 
                                studentStatuses={exam.studentStatuses} violations={exam.violations} 
                                examState={exam.examState} examTimeRemaining={exam.examTimeRemaining} 
                                startExam={exam.startExam} endExam={exam.endExam} getGradedResults={exam.getGradedResults}
                            />
                        )}
                        {activeSidebarTab === 'chat' && ('''
)

# 8. Main view override for Exam mode (if student, they see ExamStudentView instead of the video grid!)
content = content.replace(
    '''{/* VIDEO GRID / SPOTLIGHT */}
                        {layoutMode === 'spotlight' && pinnedId ? (''',
    '''{/* EXAM CANVAS OVERRIDE */}
                        {roomMode === 'exam' && !isHost ? (
                            <div style={{ flex: 1, backgroundColor: '#111827', overflowY: 'auto' }}>
                                <ExamStudentView 
                                    examState={exam.examState} questions={exam.questions} 
                                    answers={exam.answers} examTimeRemaining={exam.examTimeRemaining} 
                                    setAnswer={exam.setAnswer} submitExam={exam.submitExam} 
                                    violations={exam.violations.filter(v => v.studentId === userId)}
                                />
                            </div>
                        ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* VIDEO GRID / SPOTLIGHT */}
                        {layoutMode === 'spotlight' && pinnedId ? ('''
)

# We need to close the wrap we just opened for Exam canvas
content = content.replace(
    '''{/* Bottom Control Bar */}''',
    '''</div>
                        )}
                        {/* Bottom Control Bar */}'''
)


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Page updated!')
