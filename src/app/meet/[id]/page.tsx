"use client"

import { use, useState, useEffect, useRef, useCallback } from "react"
import { useWebRTC } from "@/hooks/useWebRTC"
import { useScamDetection } from "@/hooks/useScamDetection"
import { useVoiceAnalysis } from "@/hooks/useVoiceAnalysis"
import { useDeepfakeDetection } from "@/hooks/useDeepfakeDetection"
import { useAudioDeepfakeDetection } from "@/hooks/useAudioDeepfakeDetection"
import { useDireDetection } from "@/hooks/useDireDetection"
import { useLinkDetection } from "@/hooks/useLinkDetection"
import { useQRScanner } from "@/hooks/useQRScanner"
import { useChat } from "@/hooks/useChat"
import { useReactions } from "@/hooks/useReactions"
import { useCaptions } from "@/hooks/useCaptions"
// ── 2025/2026 Modern AI Hooks ────────────────────────────────────────────────
import { useMediaPipeFace } from "@/hooks/useMediaPipeFace"
import { useGazeTracking } from "@/hooks/useGazeTracking"
import { useObjectDetection } from "@/hooks/useObjectDetection"
import { useSentimentAnalysis } from "@/hooks/useSentimentAnalysis"
import { useStressVoiceDetection } from "@/hooks/useStressVoiceDetection"
import { useLSTMBehavior } from "@/hooks/useLSTMBehavior"
// ── NEW: Advanced AI Research Features (2025/2026) ────────────────────────────
import { useWhisperTranscription } from "@/hooks/useWhisperTranscription"
import { useSileroVAD } from "@/hooks/useSileroVAD"
import { useEngagementScore } from "@/hooks/useEngagementScore"
// ── Components ───────────────────────────────────────────────────────────────
import VideoPlayer from "@/components/VideoPlayer"
import NotificationManager from "@/components/NotificationManager"
import ScamDetectionPanel from "@/components/ScamDetectionPanel"
import FraudNetworkGraph, { FraudGraph } from "@/components/FraudNetworkGraph"
import ChatPanel from "@/components/ChatPanel"
import ParticipantsPanel from "@/components/ParticipantsPanel"
import GlobalHostDashboard from "@/components/GlobalHostDashboard"
import ReactionsBar from "@/components/ReactionsBar"
import SettingsModal from "@/components/SettingsModal"
import MeetingInfoModal from "@/components/MeetingInfoModal"
import Whiteboard from "@/components/Whiteboard"
import PollsPanel from "@/components/PollsPanel"
import BreakoutRoomsPanel from "@/components/BreakoutRoomsPanel"
import MeetingSummaryModal from "@/components/MeetingSummaryModal"
import EngagementPanel from "@/components/EngagementPanel"
import ModeSelectionScreen from "@/components/ModeSelectionScreen"
import ClassroomDashboard from "@/components/ClassroomDashboard"
import InterviewerDashboard from "@/components/InterviewerDashboard"
import InvigilatorDashboard from "@/components/InvigilatorDashboard"
import ExamStudentView from "@/components/ExamStudentView"
import AdvancedGraphicsCanvas from "@/components/AdvancedGraphicsCanvas"
import { useClassroomSession } from "@/hooks/useClassroomSession"
import { useInterviewSession } from "@/hooks/useInterviewSession"
import { useExamSession } from "@/hooks/useExamSession"
import { useActiveSpeaker } from "@/hooks/useActiveSpeaker"
import { useNetworkQuality } from "@/hooks/useNetworkQuality"
import { useNoiseCancellation } from "@/hooks/useNoiseCancellation"
import { useVirtualBackground } from "@/hooks/useVirtualBackground"
import { useAIBitrateOptimizer } from "@/hooks/useAIBitrateOptimizer"
import { useAttendanceSystem } from "@/hooks/useAttendanceSystem"
import AttendancePanel from "@/components/AttendancePanel"
import { useAITutorServer } from "@/hooks/useAITutorServer"
import AITutorPanel from "@/components/AITutorPanel"
import { useRouter } from "next/navigation"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useNervousSystem } from "@/hooks/useNervousSystem"

type SidebarTab = 'scam' | 'notify' | 'graph' | 'chat' | 'participants' | 'polls' | 'breakout' | 'exam' | 'engagement' | 'classroom' | 'interview' | 'exam_panel' | 'attendance' | 'tutor'
type RoomMode = 'office' | 'classroom' | 'interview' | 'exam' | null
type LayoutMode = 'grid' | 'spotlight'

interface Participant {
    userId: string
    displayName: string
    isMuted: boolean
    isVideoOff: boolean
    handRaised: boolean
    isHost: boolean
}

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params)
    const meetingId = unwrappedParams.id

    const [userId] = useState(() => Math.random().toString(36).substring(7))
    const [displayName] = useState(() =>
        (typeof window !== "undefined" ? sessionStorage.getItem("meet-display-name") : null) || "Guest"
    )

    const { localStream, remoteStreams, socket, isScreenSharing, startScreenShare, stopScreenShare, peersRef, replaceVideoTrackOnAllPeers } = useWebRTC(meetingId, userId)
    const router = useRouter()

    // Connect to Nervous System Event Bus
    const { broadcast, useListen } = useNervousSystem()
    useListen("AI:CRASHED", (payload) => {
        console.warn(`[MeetingPage] Detected crash in subsystem: ${payload.modelName} - ${payload.error}`)
    })

    // ── New Features State ───────────────────────────────────────────────────
    const [bgMode, setBgMode] = useState<"none" | "blur" | "image">("none")
    const [theme, setTheme] = useState<"dark" | "light">("dark")
    const [noiseReduction, setNoiseReduction] = useState(false)
    const [aiOptimizationEnabled, setAiOptimizationEnabled] = useState(true)
    // ── Feature 2 & 3 state ──────────────────────────────────────────────────
    const [showSummaryModal, setShowSummaryModal] = useState(false)
    const [meetingDurationAtEnd, setMeetingDurationAtEnd] = useState(0)

    // ── Local Stream Pipeline ────────────────────────────────────────────────
    // Feature 3: Silero VAD replaces basic noise gate when available
    const sileroVAD = useSileroVAD(localStream, noiseReduction)
    // Legacy gate is only active when Silero model hasn't loaded yet
    const { processedStream: legacyNoiseStream } = useNoiseCancellation(
        localStream,
        noiseReduction && !sileroVAD.modelReady && !sileroVAD.usingFallback
    )
    const noiseGatedStream = noiseReduction
        ? (sileroVAD.processedStream || legacyNoiseStream)
        : null
    const { outputStream: bgStream } = useVirtualBackground(
        noiseGatedStream || localStream,
        bgMode !== "none",
        bgMode,
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1000&auto=format&fit=crop"
    )
    const finalLocalStream = bgStream || noiseGatedStream || localStream


    useEffect(() => {
        if (finalLocalStream && !isScreenSharing) {
            const track = finalLocalStream.getVideoTracks()[0]
            if (track) replaceVideoTrackOnAllPeers(track)
        }
    }, [finalLocalStream, isScreenSharing, replaceVideoTrackOnAllPeers])

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme)
    }, [theme])

    // ── Network & Speaker ────────────────────────────────────────────────────
    const networkQualities = useNetworkQuality(peersRef)
    const activeSpeakerId = useActiveSpeaker(peersRef, finalLocalStream, userId)
    const { optimalBitrate } = useAIBitrateOptimizer(peersRef, aiOptimizationEnabled)

    // ── UI State ─────────────────────────────────────────────────────────────
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [pinnedId, setPinnedId] = useState<string | null>(null)
    const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('scam')
    const [fraudGraph, setFraudGraph] = useState<FraudGraph>({ nodes: [], edges: [] })
    const [layoutMode] = useState<LayoutMode>('grid')
    const [showSettings, setShowSettings] = useState(false)
    const [showInfo, setShowInfo] = useState(false)
    const [showWhiteboard, setShowWhiteboard] = useState(false)
    const [captionsEnabled, setCaptionsEnabled] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [roomLocked, setRoomLocked] = useState(false)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [handRaised, setHandRaised] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [meetingStartTime] = useState(Date.now())
    const [elapsed, setElapsed] = useState("0:00")
    const [roomMode, setRoomMode] = useState<RoomMode>(null)
    const [incomingAlert, setIncomingAlert] = useState<{ participantId: string; riskScore: number; triggeredFeatures: string[] } | null>(null)
    const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([])

    // ── Recording ─────────────────────────────────────────────────────────────
    const [isRecording, setIsRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordedChunksRef = useRef<BlobPart[]>([])

    // ── Local video ref ───────────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // ── AI Active Defense Option Selector ─────────────────────────────────────
    const [aiOptions, setAiOptions] = useState({
        deepfakeVideo: true,
        deepfakeAudio: true,
        gazeTracking: false,
        facialLandmarks: true,
        voiceStress: false,
        objectDetection: false,
        linkScanner: true,
        keywordSentiment: true,
        behavioral: true,
    })



    // ── Host Detection (Server-Authoritative) ─────────────────────────────────
    // isHost is now confirmed by the SERVER via the "host-confirmed" socket event.
    // Clients can NOT fake host status by editing sessionStorage or DevTools.
    // We seed from sessionStorage only as a UX hint before the socket confirms.
    const [isHost, setIsHost] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false
        return sessionStorage.getItem(`meet-host-${meetingId}`) === 'true'
    })
    // Also track remote participants' engagement scores (sent by server relay)
    const [remoteEngagements, setRemoteEngagements] = useState<Map<string, {
        userId: string; displayName: string; score: number;
        level: string; trend: string;
        breakdown: { gazeScore: number; faceScore: number; calmScore: number; behaviorScore: number }
    }>>(new Map())
    // Fact-check document generation state
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false)

    // ── Scam Detection ────────────────────────────────────────────────────────
    const scam = useScamDetection(userId)

    // ── ML Optimization per Mode ──────────────────────────────────────────────
    const isExam = roomMode === 'exam';
    const isInterview = roomMode === 'interview';
    const isClassroom = roomMode === 'classroom';
    const isOffice = roomMode === 'office' || roomMode === null;

    const enableFace = isExam || isClassroom || (isOffice && aiOptions.facialLandmarks);
    const enableGaze = isClassroom || isInterview || (isOffice && aiOptions.gazeTracking);
    const enableObjects = isExam || (isOffice && aiOptions.objectDetection);
    const enableSentiment = isInterview || (isOffice && aiOptions.keywordSentiment);
    const enableStress = isInterview || (isOffice && aiOptions.voiceStress);
    const enableDeepfakeVideo = isOffice && aiOptions.deepfakeVideo;
    const enableDeepfakeAudio = isOffice && aiOptions.deepfakeAudio;
    const enableLinkScanner = isOffice && aiOptions.linkScanner;
    const enableBehavioral = isClassroom || isInterview || (isOffice && aiOptions.behavioral);

    // ── 2025/2026 Modern AI Hooks ─────────────────────────────────────────────
    const mediaPipeFace = useMediaPipeFace({
        videoRef: localVideoRef,
        enabled: scam.isEnabled && enableFace,
        updateScore: scam.updateScore,
    })
    const gaze = useGazeTracking({
        faceResult: mediaPipeFace,
        enabled: scam.isEnabled && enableGaze,
    })
    const objectDetection = useObjectDetection({
        videoRef: localVideoRef,
        enabled: scam.isEnabled && enableObjects,
        updateScore: scam.updateScore,
    })
    const sentiment = useSentimentAnalysis({ enabled: scam.isEnabled && enableSentiment })
    const stressVoice = useStressVoiceDetection({
        stream: localStream,
        enabled: scam.isEnabled && enableStress,
        updateScore: scam.updateScore,
    })
    const voice = useVoiceAnalysis({ enabled: scam.isEnabled && enableSentiment, updateScore: scam.updateScore })
    const deepfake = useDeepfakeDetection({ videoRef: localVideoRef, enabled: scam.isEnabled && enableDeepfakeVideo, updateScore: scam.updateScore })
    const audioDeepfake = useAudioDeepfakeDetection({ localStream, enabled: scam.isEnabled && enableDeepfakeAudio, updateScore: scam.updateScore })
    const dire = useDireDetection({ videoRef: localVideoRef, enabled: scam.isEnabled && enableDeepfakeVideo, updateScore: scam.updateScore })
    const linkScanner = useLinkDetection({ enabled: scam.isEnabled && enableLinkScanner, updateScore: scam.updateScore })
    const [mockChatInput, setMockChatInput] = useState("")
    const qrScanner = useQRScanner({
        videoRef: localVideoRef,
        enabled: scam.isEnabled && enableLinkScanner,
        onQRDetected: (url) => linkScanner.scanMessage(url)
    })

    // ── ML Brain: LSTM Autoencoder (“learn normal”) ─────────────────────────────────
    const lstm = useLSTMBehavior({
        enabled: scam.isEnabled && enableBehavioral,
        gazeDirection: gaze.direction,
        faceCount: mediaPipeFace.faceCount,
        stressLevel: stressVoice.stressLevel,
        objectCount: objectDetection.suspiciousObjects.length,
    })
    // Feed LSTM anomaly score into Bayes engine on every update
    useEffect(() => {
        if (lstm.anomalyScore > 0) scam.updateLSTMAnomaly(lstm.anomalyScore)
    }, [lstm.anomalyScore])

    // ── Feature 1: WebGPU Whisper transcription (replaces browser SpeechRecognition) ─
    const whisper = useWhisperTranscription(localStream, displayName, captionsEnabled)

    // ── Feature 4: Engagement Score (fuses gaze + face + stress + LSTM) ──────────
    const localEngagement = useEngagementScore({
        enabled: scam.isEnabled,
        gazeDirection: gaze.direction,
        faceCount: mediaPipeFace.faceCount,
        stressLevel: stressVoice.stressLevel,
        lstmAnomaly: lstm.anomalyScore,
    })



    // ── Session Modes Hooks ───────────────────────────────────────────────────
    const classroom = useClassroomSession(socket, userId, isHost)
    const interview = useInterviewSession({
        socket, userId, isHost,
        eyeContactScore: gaze.gazeAttentionScore,
        stressLevel: stressVoice.stressLevel,
        isSpeaking: stressVoice.isSpeaking,
        emotions: sentiment.latestResult?.emotions,
        semanticFraudIntent: sentiment.latestResult?.semanticFraudIntent
    })
    const exam = useExamSession(socket, userId, isHost)

    // ── AI Tutor Server (Ollama P2P) ──────────────────────────────────────────
    const tutor = useAITutorServer(socket, isHost)

    // ── Attendance System ─────────────────────────────────────────────────────
    const attendance = useAttendanceSystem({
        socket,
        userId,
        displayName,
        isHost,
        meetingId,
        mode: roomMode ?? undefined,
        faceCount: mediaPipeFace.faceCount,
        blinkRate: mediaPipeFace.blinkRate,
        headYaw: mediaPipeFace.headYaw,
        headPitch: mediaPipeFace.headPitch,
        faceDetected: mediaPipeFace.faceDetected,
    })

    // ── Chat ──────────────────────────────────────────────────────────────────
    const chat = useChat(socket, userId, displayName)

    // ── Reactions ─────────────────────────────────────────────────────────────
    const reactions = useReactions(socket, userId, displayName)

    // ── Captions ─────────────────────────────────────────────────────────────
    // Feature 1: Whisper (local AI) is primary; browser SpeechRecognition is fallback
    const { latestCaption: legacyCaption } = useCaptions(socket, userId, displayName, captionsEnabled && !whisper.isReady)
    const latestCaption = captionsEnabled
        ? (whisper.latestCaption ?? legacyCaption)
        : null

    // ── Participants list from server ─────────────────────────────────────────
    useEffect(() => {
        if (!socket) return
        const onUpdate = (list: Participant[]) => setParticipants(list)
        socket.on("participants-update", onUpdate)
        return () => { socket.off("participants-update", onUpdate) }
    }, [socket])

    // ── Kicked event ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return
        socket.on("kicked", () => {
            alert("You have been removed from this meeting by the host.")
            endCall()
        })
        socket.on("force-mute", () => {
            if (localStream) {
                localStream.getAudioTracks().forEach(t => { t.enabled = false })
                setIsMuted(true)
                socket.emit("status-update", { userId, isMuted: true, isVideoOff })
            }
        })
        socket.on("room-locked", (locked: boolean) => setRoomLocked(locked))
        return () => {
            socket.off("kicked")
            socket.off("force-mute")
            socket.off("room-locked")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, localStream])

    // ── Scam alerts ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket || !scam.isEnabled) return
        if (scam.isHighRisk) {
            socket.emit("scam-alert", {
                participantId: userId,
                riskScore: scam.riskScore,
                triggeredFeatures: Object.entries(scam.scores).filter(([, v]) => v > 50).map(([k]) => k),
            })
        }
    }, [scam.isHighRisk, scam.riskScore, socket, scam.isEnabled, userId, scam.scores])

    useEffect(() => {
        if (!socket) return
        const onAlert = (data: { participantId: string; riskScore: number; triggeredFeatures: string[] }) => {
            if (data.participantId !== userId) setIncomingAlert(data)
        }
        socket.on("scam-alert", onAlert)
        return () => { socket.off("scam-alert", onAlert) }
    }, [socket, userId])

    useEffect(() => {
        if (!socket) return
        socket.emit("request-graph", meetingId)
        const onGraphUpdate = (graph: FraudGraph) => setFraudGraph(graph)
        socket.on("graph-update", onGraphUpdate)
        return () => { socket.off("graph-update", onGraphUpdate) }
    }, [socket, meetingId])



    // ── Analyze incoming chat messages for scam sentiment ─────────────────────
    useEffect(() => {
        const lastMsg = chat.messages[chat.messages.length - 1]
        if (!lastMsg || lastMsg.senderId === userId) return
        sentiment.analyzeText(lastMsg.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chat.messages.length])

    // ── Floating reactions display ────────────────────────────────────────────
    useEffect(() => {
        reactions.reactions.forEach(r => {
            const floating = { id: r.id, emoji: r.emoji, x: Math.random() * 80 + 10 }
            setFloatingReactions(prev => [...prev, floating])
            setTimeout(() => setFloatingReactions(prev => prev.filter(f => f.id !== r.id)), 3500)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reactions.reactions.length])

    // ── Meeting timer ─────────────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            const diff = Math.floor((Date.now() - meetingStartTime) / 1000)
            const m = Math.floor(diff / 60)
            const s = diff % 60
            setElapsed(`${m}:${s.toString().padStart(2, "0")}`)
        }, 1000)
        return () => clearInterval(interval)
    }, [meetingStartTime])

    useEffect(() => { setMounted(true) }, [])

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
            switch (e.key.toUpperCase()) {
                case "M": toggleAudio(); break
                case "V": toggleVideo(); break
                case "C": setActiveSidebarTab(t => t === "chat" ? "scam" : "chat"); break
                case "S": isScreenSharing ? stopScreenShare() : startScreenShare(); break
                case "R": break // Reactions bar is toggle via button
                case "ESCAPE": setShowSettings(false); setShowInfo(false); setShowWhiteboard(false); break
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMuted, isVideoOff, isScreenSharing])

    // ── Controls ──────────────────────────────────────────────────────────────
    const toggleAudio = useCallback(() => {
        if (localStream) {
            const next = !isMuted
            localStream.getAudioTracks().forEach(t => { t.enabled = !next })
            setIsMuted(next)
            socket?.emit("status-update", { userId, isMuted: next, isVideoOff })
        }
    }, [localStream, isMuted, socket, userId, isVideoOff])

    const toggleVideo = useCallback(() => {
        if (localStream) {
            const next = !isVideoOff
            localStream.getVideoTracks().forEach(t => { t.enabled = !next })
            setIsVideoOff(next)
            socket?.emit("status-update", { userId, isMuted, isVideoOff: next })
        }
    }, [localStream, isVideoOff, socket, userId, isMuted])

    const toggleHand = useCallback(() => {
        const next = !handRaised
        setHandRaised(next)
        socket?.emit(next ? "raise-hand" : "lower-hand", userId)
    }, [handRaised, socket, userId])

    const startRecording = async () => {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            const mr = new MediaRecorder(displayStream, { mimeType: "video/webm; codecs=vp9" })
            mediaRecorderRef.current = mr
            recordedChunksRef.current = []
            mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
            mr.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: "video/webm" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a"); a.href = url; a.download = `Meet-${meetingId}.webm`
                document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url)
                setIsRecording(false); displayStream.getTracks().forEach(t => t.stop())
            }
            mr.start(); setIsRecording(true)
            displayStream.getVideoTracks()[0].onended = () => mr.stop()
        } catch (err) { console.error("Recording failed:", err) }
    }
    const stopRecording = () => { if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop() }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const endCall = () => {
        stopRecording()
        // Feature 2: Show AI summary if we have Whisper transcript
        const transcript = whisper.getFullTranscript()
        if (transcript.trim()) {
            setMeetingDurationAtEnd(Date.now() - meetingStartTime)
            if (localStream) localStream.getTracks().forEach(t => t.stop())
            setShowSummaryModal(true)
            return
        }
        if (localStream) localStream.getTracks().forEach(t => t.stop())
        router.push("/")
    }

    const finishAndLeave = () => {
        setShowSummaryModal(false)
        router.push("/")
    }

    const allStreams = [
        { id: 'local', stream: finalLocalStream, label: displayName },
        ...Object.entries(remoteStreams).map(([id, stream]) => ({
            id,
            stream,
            label: participants.find(p => p.userId === id)?.displayName || `Guest`
        }))
    ]

    const outerBorder = scam.isHighRisk
        ? "2px solid rgba(239,68,68,0.5)"
        : scam.isMediumRisk
            ? "2px solid rgba(245,158,11,0.4)"
            : "2px solid transparent"

    useEffect(() => {
        if (!socket) return
        socket.on("mode-select", (mode: any) => setRoomMode(mode))
        return () => { socket.off("mode-select") }
    }, [socket])

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
    }

    let sidebarTabs: { key: SidebarTab; icon: string; label: string }[] = [
        { key: 'scam', icon: '🛡️', label: 'Scam AI' },
        { key: 'attendance', icon: '🎓', label: 'Attendance' },
        { key: 'tutor', icon: '🤖', label: 'AI Tutor' },
        { key: 'chat', icon: '💬', label: 'Chat' },
        { key: 'participants', icon: '👥', label: 'People' },
        { key: 'graph', icon: '🕸️', label: 'Threats' },
        { key: 'polls', icon: '📊', label: 'Polls' },
        { key: 'breakout', icon: '🚪', label: 'Rooms' },
        { key: 'engagement', icon: '📈', label: 'Engage' },
        // Mode-specific tabs
        ...(roomMode === 'classroom' ? [{ key: 'classroom' as SidebarTab, icon: '🏫', label: 'Class' }] : []),
        ...(roomMode === 'interview' ? [{ key: 'interview' as SidebarTab, icon: '🎤', label: 'Interview' }] : []),
        ...(roomMode === 'exam' ? [{ key: 'exam_panel' as SidebarTab, icon: '📝', label: 'Exam Hall' }] : []),
    ]

    // Restrict student sidebars
    if (!isHost) {
        // Students only see limited tabs
        sidebarTabs = sidebarTabs.filter(tab => !['scam', 'graph', 'breakout', 'engagement', 'exam_panel'].includes(tab.key))
        
        // Hide Chat and Polls in Exam Mode
        if (roomMode === 'exam') {
            sidebarTabs = sidebarTabs.filter(tab => !['chat', 'polls'].includes(tab.key))
        }
    }

    return (
        <div ref={containerRef} style={{
            backgroundColor: "#000000", height: "100vh", display: "flex", flexDirection: "column",
            border: outerBorder, transition: "border-color 0.5s ease", boxSizing: "border-box", position: "relative"
        }}>
            {/* ── Modals ── */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onDevicesSelected={() => { }} />}
            {showInfo && <MeetingInfoModal meetingId={meetingId} onClose={() => setShowInfo(false)} />}
            {showWhiteboard && socket && <Whiteboard socket={socket} roomId={meetingId} onClose={() => setShowWhiteboard(false)} />}
            {/* ── Feature 2: AI Meeting Summary Modal ── */}
            {showSummaryModal && (
                <MeetingSummaryModal
                    transcript={whisper.getFullTranscript()}
                    chatMessages={chat.messages.map(m => ({ sender: m.senderName, text: m.text }))}
                    durationMs={meetingDurationAtEnd}
                    participantNames={[displayName, ...participants.map(p => p.displayName)]}
                    onClose={finishAndLeave}
                />
            )}

            {/* ── Feature 3: Silero VAD status bar (shown when noise reduction on) ── */}
            {noiseReduction && (
                <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "4px 16px",
                    background: "rgba(0,0,0,0.35)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    fontSize: "11px",
                    zIndex: 10,
                }}>
                    <span style={{
                        width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                        background: sileroVAD.isSpeaking ? "#22c55e" : "#6b7280",
                        boxShadow: sileroVAD.isSpeaking ? "0 0 6px #22c55e" : "none",
                        transition: "background 0.15s, box-shadow 0.15s",
                    }} />
                    <span style={{ color: sileroVAD.isSpeaking ? "#22c55e" : "#6b7280" }}>
                        {sileroVAD.usingFallback
                            ? "🔇 Noise Gate (fallback)"
                            : sileroVAD.modelReady
                                ? "🧠 Silero VAD"
                                : "⏳ Loading VAD model…"}
                        {" · "}
                        {sileroVAD.isSpeaking ? "SPEAKING" : "SILENCE"}
                        {sileroVAD.modelReady && !sileroVAD.usingFallback && (
                            <span style={{ color: "#4b5563", marginLeft: "4px" }}>
                                ({Math.round(sileroVAD.speechProbability * 100)}%)
                            </span>
                        )}
                    </span>
                    {captionsEnabled && (
                        <span style={{ marginLeft: "auto", color: whisper.isReady ? "#60a5fa" : "#6b7280" }}>
                            {whisper.isReady
                                ? (whisper.isTranscribing ? "✍️ Transcribing…" : "🎙 Whisper ready")
                                : `⬇️ Loading Whisper… ${whisper.modelLoadProgress}%`}
                        </span>
                    )}
                </div>
            )}

            {/* ── Floating Reactions ── */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100, overflow: "hidden" }}>
                {floatingReactions.map(r => (
                    <div key={r.id} style={{
                        position: "absolute", bottom: "100px", left: `${r.x}%`, fontSize: "36px",
                        animation: "floatUp 3.5s ease forwards", pointerEvents: "none"
                    }}>{r.emoji}</div>
                ))}
            </div>



            {/* ── Scam Alert Banner ── */}
            {scam.isHighRisk && scam.isEnabled && (
                <div style={{
                    background: "repeating-linear-gradient(45deg, #7f1212, #7f1212 10px, #a51c1c 10px, #a51c1c 20px)",
                    borderBottom: "4px solid #ef4444", boxShadow: "0 4px 20px rgba(239,68,68,0.5)",
                    padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    zIndex: 50, animation: "strobeWarning 0.8s infinite alternate"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "white" }}>
                        <span style={{ fontSize: "28px", animation: "pulse 1s infinite" }}>🚨</span>
                        <div>
                            <strong style={{ fontSize: "16px", letterSpacing: "1px", textTransform: "uppercase" }}>
                                CRITICAL WARNING: YOU ARE NOT SAFE
                            </strong>
                            <div style={{ fontSize: "12px", marginTop: "2px", fontWeight: "bold", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px", display: "inline-block" }}>
                                FAKE FEED DETECTED (Risk Score: {scam.riskScore}/100) — DO NOT TRUST THIS CALLER
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={endCall} style={{ background: "#ef4444", border: "2px solid white", color: "white", padding: "6px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}>
                            END CALL NOW
                        </button>
                        <button onClick={() => scam.resetScores()} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* ── Screen share banner ── */}
            {isScreenSharing && (
                <div style={{ background: "#1a73e8", padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "white", fontSize: "14px" }}>📺 You are sharing your screen</span>
                    <button onClick={stopScreenShare} style={{ background: "white", border: "none", borderRadius: "6px", padding: "4px 12px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>Stop Sharing</button>
                </div>
            )}

            {/* ── Kicked from room notification ── */}
            {roomLocked && !isHost && (
                <div style={{ background: "#f59e0b", padding: "6px 24px", color: "#000", fontSize: "13px", textAlign: "center" }}>
                    🔒 This meeting is locked — no new participants can join.
                </div>
            )}

            {/* ── Top Bar ── */}
            <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "white", fontSize: "1.1rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>🛡️</span>
                    <span>Meet Clone</span>
                    <span style={{ color: "#5f6368", fontSize: "12px" }}>|</span>
                    <span style={{ color: "#9ca3af", fontSize: "13px", fontFamily: "monospace" }}>
                        {meetingId.length >= 9 ? meetingId.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3") : meetingId}
                    </span>
                    {isRecording && (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", backgroundColor: "rgba(234,67,53,0.15)", color: "#ea4335", padding: "3px 8px", borderRadius: "4px" }}>
                            <span style={{ width: "7px", height: "7px", backgroundColor: "#ea4335", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                            REC
                        </span>
                    )}
                    {handRaised && <span style={{ fontSize: "18px", animation: "pulse 1s infinite" }}>✋</span>}
                    {scam.isEnabled && (
                        <span style={{
                            fontSize: "11px", fontWeight: "700",
                            color: scam.isHighRisk ? "#ef4444" : scam.isMediumRisk ? "#f59e0b" : "#22c55e",
                            background: scam.isHighRisk ? "#ef444415" : scam.isMediumRisk ? "#f59e0b15" : "#22c55e15",
                            border: `1px solid ${scam.isHighRisk ? "#ef444440" : scam.isMediumRisk ? "#f59e0b40" : "#22c55e40"}`,
                            padding: "2px 8px", borderRadius: "99px"
                        }}>Risk: {scam.riskScore}</span>
                    )}
                    {aiOptimizationEnabled && (
                        <span style={{
                            fontSize: "11px", fontWeight: "700", color: "#8ab4f8",
                            background: "#8ab4f815", border: "1px solid #8ab4f840",
                            padding: "2px 8px", borderRadius: "99px"
                        }}>AI QoS: {(optimalBitrate / 1000).toFixed(0)}kbps</span>
                    )}
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", color: "white", fontSize: "13px" }}>
                    <span style={{ color: "#9ca3af" }}>⏱ {elapsed}</span>
                    <span style={{ color: "#9ca3af" }}>{mounted ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>

                    <button onClick={() => setShowInfo(true)} title="Meeting info" style={{ background: "none", border: "1px solid #5f6368", borderRadius: "6px", color: "white", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }}>📋 Info</button>
                    <button onClick={toggleFullscreen} title="Fullscreen" style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "18px" }}>{isFullscreen ? "⊡" : "⛶"}</button>
                    {isHost && (
                        <button onClick={() => { setRoomLocked(l => { const next = !l; socket?.emit("lock-room", next); return next }) }}
                            title={roomLocked ? "Unlock meeting" : "Lock meeting"}
                            style={{ background: "none", border: "none", color: roomLocked ? "#f59e0b" : "#9ca3af", cursor: "pointer", fontSize: "18px" }}>
                            {roomLocked ? "🔒" : "🔓"}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main Area ── */}
            <div style={{ flex: 1, padding: "16px", display: "flex", gap: "16px", overflow: "hidden" }}>
                {/* Video grid */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {roomMode === 'exam' && !isHost ? (
                        <ExamStudentView
                            examState={exam.examState}
                            questions={exam.questions}
                            answers={exam.answers}
                            examTimeRemaining={exam.examTimeRemaining}
                            setAnswer={exam.setAnswer}
                            submitExam={exam.submitExam}
                            violations={exam.violations.filter(v => v.studentId === userId)}
                        />
                    ) : pinnedId || layoutMode === 'spotlight' ? (
                        <>
                            <div style={{ height: "calc(100% - 120px)" }}>
                                <VideoPlayer
                                    stream={allStreams.find(s => s.id === (pinnedId || allStreams[0].id))?.stream || null}
                                    muted={pinnedId === 'local'}
                                    label={allStreams.find(s => s.id === (pinnedId || allStreams[0].id))?.label}
                                    isPinned
                                />
                            </div>
                            <div style={{ height: "100px", display: "flex", gap: "8px", marginTop: "12px", overflowX: "auto" }}>
                                {allStreams.filter(s => s.id !== (pinnedId || allStreams[0]?.id)).map(({ id, stream, label }) => (
                                    <div key={id} style={{ flexShrink: 0, width: "160px", cursor: "pointer" }} onClick={() => setPinnedId(id)}>
                                        <VideoPlayer stream={stream} muted={id === 'local'} label={label} />
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(allStreams.length)), 3)}, 1fr)`,
                            gap: "12px", width: "100%", height: "100%"
                        }}>
                            {allStreams.map(({ id, stream, label }) => (
                                <div key={id} onClick={() => setPinnedId(id)} style={{ cursor: "pointer", height: "100%", width: "100%" }}>
                                    <VideoPlayer
                                        ref={id === 'local' ? localVideoRef : undefined}
                                        stream={stream}
                                        muted={id === 'local'}
                                        label={label}
                                        riskScore={id === 'local' ? scam.riskScore : undefined}
                                        deepfakeLabel={id === 'local' && deepfake.label !== 'Real' ? deepfake.label : null}
                                        isActiveSpeaker={activeSpeakerId === id}
                                        networkQuality={networkQualities[id]?.quality}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Caption overlay */}
                    {captionsEnabled && latestCaption && (
                        <div style={{
                            position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)",
                            background: "rgba(0,0,0,0.8)", color: "white", padding: "8px 20px",
                            borderRadius: "8px", fontSize: "16px", maxWidth: "80%", textAlign: "center",
                            backdropFilter: "blur(4px)"
                        }}>
                            <span style={{ color: "#8ab4f8", fontSize: "12px", marginRight: "8px" }}>{latestCaption.speakerName}:</span>
                            {latestCaption.text}
                        </div>
                    )}
                </div>

                {/* ── Sidebar ── */}
                <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0 }}>
                    {/* Sidebar tabs */}
                    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                        {sidebarTabs.map(tab => (
                            <button key={tab.key} onClick={() => {
                                setActiveSidebarTab(tab.key)
                                if (tab.key === "chat") chat.markRead()
                            }} style={{
                                flex: 1, padding: "5px 2px", borderRadius: "8px", cursor: "pointer",
                                background: activeSidebarTab === tab.key ? "#3c4043" : "transparent",
                                color: activeSidebarTab === tab.key ? "white" : "#9ca3af",
                                border: activeSidebarTab === tab.key ? "1px solid #ffffff20" : "1px solid transparent",
                                fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center",
                                gap: "2px", transition: "all 0.2s", whiteSpace: "nowrap", position: "relative"
                            }}>
                                {tab.icon} {tab.label}
                                {tab.key === "chat" && chat.unreadCount > 0 && (
                                    <span style={{
                                        position: "absolute", top: "-4px", right: "-2px",
                                        background: "#ea4335", color: "white", borderRadius: "50%",
                                        fontSize: "9px", width: "16px", height: "16px",
                                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold"
                                    }}>{chat.unreadCount}</span>
                                )}
                                {tab.key === "participants" && (
                                    <span style={{ background: "#5f6368", borderRadius: "99px", padding: "0 5px", fontSize: "9px", marginLeft: "2px" }}>
                                        {participants.length || 1}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", height: "calc(100% - 46px)" }}>
                        {activeSidebarTab === 'attendance' && (
                            <AttendancePanel
                                isHost={isHost}
                                userId={userId}
                                displayName={displayName}
                                attendance={attendance}
                                roomMode={roomMode}
                            />
                        )}
                        {activeSidebarTab === 'scam' && (
                            <ScamDetectionPanel
                                riskScore={scam.riskScore} scores={scam.scores}
                                isHighRisk={scam.isHighRisk} isMediumRisk={scam.isMediumRisk}
                                isEnabled={scam.isEnabled} setIsEnabled={scam.setIsEnabled}
                                alertHistory={scam.alertHistory} audioLabel={audioDeepfake.label}
                                audioScore={audioDeepfake.score} deepfakeLabel={deepfake.label}
                                deepfakeScore={deepfake.confidence}
                                puppetLabel={mediaPipeFace.stressScore > 60 ? "Unnatural Expression" : "Natural Motion"}
                                puppetScore={mediaPipeFace.stressScore}
                                direLabel={dire.label}
                                direScore={dire.score} direMode={dire.mode} direServerOnline={dire.serverOnline}
                                detectedKeywords={voice.detectedKeywords} flaggedLinks={linkScanner.flaggedLinks}
                                lastDetectedQR={qrScanner.lastDetectedQR}
                                mlInsights={scam.mlInsights}
                                lstmPhase={lstm.phase}
                                lstmBootstrapProgress={lstm.bootstrapProgress}
                                aiOptions={aiOptions}
                                setAiOptions={setAiOptions}
                            />
                        )}
                        {activeSidebarTab === 'classroom' && roomMode === 'classroom' && (
                            <ErrorBoundary fallbackText="Classroom AI Offline">
                                <ClassroomDashboard 
                                    isHost={isHost} userId={userId} displayName={displayName} 
                                    session={classroom.session} launchQuiz={classroom.launchQuiz} 
                                    endQuiz={classroom.endQuiz} addNote={classroom.addNote} 
                                    getReportData={classroom.getReportData} transcript={whisper.getFullTranscript()} 
                                />
                            </ErrorBoundary>
                        )}
                        {activeSidebarTab === 'interview' && roomMode === 'interview' && (
                            <ErrorBoundary fallbackText="Interview Tracker Offline">
                                <InterviewerDashboard 
                                    isHost={isHost} metrics={interview.metrics} flags={interview.flags} 
                                    notes={interview.notes} interviewDuration={interview.interviewDuration} 
                                    addFlag={interview.addFlag} addNote={interview.addNote} 
                                    removeFlag={interview.removeFlag} getReportData={interview.getReportData} 
                                    transcript={whisper.getFullTranscript()} 
                                />
                            </ErrorBoundary>
                        )}
                        {activeSidebarTab === 'exam_panel' && roomMode === 'exam' && isHost && (
                            <ErrorBoundary fallbackText="Exam Engine Offline">
                                <InvigilatorDashboard 
                                    studentStatuses={exam.studentStatuses} violations={exam.violations} 
                                    examState={exam.examState} examTimeRemaining={exam.examTimeRemaining} 
                                    startExam={exam.startExam} endExam={exam.endExam} getGradedResults={exam.getGradedResults}
                                />
                            </ErrorBoundary>
                        )}
                        {activeSidebarTab === 'chat' && (
                            <ChatPanel
                                messages={chat.messages}
                                currentUserId={userId}
                                onSend={chat.sendMessage}
                                onSendImage={chat.sendImage}
                                onOpen={chat.markRead}
                                onClose={chat.markClosed}
                            />
                        )}
                        {activeSidebarTab === 'participants' && (
                            isHost ? (
                                <GlobalHostDashboard
                                    participants={participants.length > 0 ? participants : [{ userId, displayName, isMuted, isVideoOff, handRaised, isHost: true }]}
                                    currentUserId={userId}
                                    roomMode={roomMode}
                                    onMuteAll={() => socket?.emit("mute-all")}
                                    onMuteUser={(uid) => socket?.emit("mute-user", { targetUserId: uid })}
                                    onKickUser={(uid) => socket?.emit("kick-user", { targetUserId: uid })}
                                    onBlockIp={(uid) => socket?.emit("ban-user", { targetUserId: uid })}
                                />
                            ) : (
                                <ParticipantsPanel
                                    participants={participants.length > 0 ? participants : [{ userId, displayName, isMuted, isVideoOff, handRaised, isHost: false }]}
                                    currentUserId={userId}
                                    isHost={isHost}
                                    handRaised={handRaised}
                                    onToggleHand={toggleHand}
                                    onMuteAll={() => {}}
                                    onMuteUser={(uid) => {}}
                                    onKickUser={(uid) => {}}
                                />
                            )
                        )}
                        {activeSidebarTab === 'polls' && <PollsPanel socket={socket} userId={userId} displayName={displayName} isHost={isHost} />}
                        {activeSidebarTab === 'breakout' && <BreakoutRoomsPanel socket={socket} userId={userId} isHost={isHost} participants={participants} mainRoomId={meetingId as string} />}
                        {activeSidebarTab === 'graph' && <FraudNetworkGraph graph={fraudGraph} />}
                        {activeSidebarTab === 'notify' && <NotificationManager meetingId={meetingId as string} />}
                        {activeSidebarTab === 'tutor' && (
                            <ErrorBoundary fallbackText="AI Tutor Offline">
                                <AITutorPanel 
                                    isHost={isHost} 
                                    socket={socket} 
                                    studentId={userId} 
                                    studentName={displayName} 
                                    serverStatus={tutor.isServerActive} 
                                    logs={tutor.logs} 
                                />
                            </ErrorBoundary>
                        )}
                        {/* ── Feature 4: Engagement Panel ── */}
                        {activeSidebarTab === 'engagement' && (
                            <ErrorBoundary fallbackText="Engagement Analytics Offline">
                                <EngagementPanel
                                    isHost={isHost}
                                    participants={[
                                        {
                                            userId,
                                            displayName,
                                            isLocal: true,
                                            engagement: localEngagement,
                                        },
                                        ...participants
                                            .filter(p => p.userId !== userId)
                                            .map(p => ({
                                                userId: p.userId,
                                                displayName: p.displayName,
                                                isLocal: false,
                                                engagement: {
                                                    score: 0,
                                                    level: 'Absent' as const,
                                                    trend: 'stable' as const,
                                                    history: [],
                                                    breakdown: { gazeScore: 0, faceScore: 0, calmScore: 0, behaviorScore: 0 },
                                                },
                                            }))
                                    ]}
                                />
                            </ErrorBoundary>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Control Bar ── */}
            <div style={{ height: "80px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", flexShrink: 0 }}>
                {/* Left: scan input */}
                <div style={{ flex: 1 }}>
                    <input type="text" placeholder="Scan link (e.g. bit.ly/refund)" value={mockChatInput}
                        onChange={e => setMockChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && mockChatInput.trim()) { linkScanner.scanMessage(mockChatInput); setMockChatInput("") } }}
                        style={{ background: "#202124", color: "white", border: "1px solid #5f6368", borderRadius: "20px", padding: "7px 14px", fontSize: "13px", width: "220px", outline: "none" }}
                    />
                </div>

                {/* Center: main controls */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", flex: 1 }}>
                    {/* Mic */}
                    <CtrlBtn onClick={toggleAudio} active={isMuted} title="Mute (M)">
                        {isMuted
                            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                        }
                    </CtrlBtn>
                    {/* Camera */}
                    <CtrlBtn onClick={toggleVideo} active={isVideoOff} title="Camera (V)">
                        {isVideoOff
                            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                        }
                    </CtrlBtn>
                    {/* Screen share */}
                    {isHost && (
                        <CtrlBtn onClick={isScreenSharing ? stopScreenShare : startScreenShare} active={isScreenSharing} title="Screen Share (S)" activeColor="#22c55e">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                        </CtrlBtn>
                    )}
                    {/* Recording */}
                    {isHost && (
                        <CtrlBtn onClick={isRecording ? stopRecording : startRecording} active={isRecording} title="Record">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                {isRecording ? <rect x="9" y="9" width="6" height="6" fill="currentColor" /> : <circle cx="12" cy="12" r="3" fill="currentColor" />}
                            </svg>
                        </CtrlBtn>
                    )}
                    {/* Captions */}
                    <CtrlBtn onClick={() => setCaptionsEnabled(v => !v)} active={captionsEnabled} title="Captions" activeColor="#22c55e">
                        <span style={{ fontSize: "13px", fontWeight: "bold" }}>CC</span>
                    </CtrlBtn>
                    {/* Whiteboard */}
                    {isHost && (
                        <CtrlBtn onClick={() => setShowWhiteboard(v => !v)} title="Whiteboard">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="16" rx="2" /><path d="M6 20h12M8 16l3-6 3 6" /></svg>
                        </CtrlBtn>
                    )}
                    {/* Unpin / grid */}
                    <CtrlBtn onClick={() => setPinnedId(null)} title="Grid view">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><rect x="7" y="7" width="3" height="3" /><rect x="14" y="7" width="3" height="3" /><rect x="7" y="14" width="3" height="3" /><rect x="14" y="14" width="3" height="3" /></svg>
                    </CtrlBtn>
                    {/* Reactions */}
                    {(!isExam || isHost) && <ReactionsBar onReact={reactions.sendReaction} />}
                    {/* Settings */}
                    <CtrlBtn onClick={() => setShowSettings(true)} title="Settings (⚙️)">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    </CtrlBtn>
                    {/* Theme */}
                    <CtrlBtn onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Switch Theme">
                        <span style={{ fontSize: "16px" }}>{theme === "dark" ? "☀️" : "🌙"}</span>
                    </CtrlBtn>
                    {/* Background */}
                    <CtrlBtn onClick={() => setBgMode(m => m === "none" ? "blur" : m === "blur" ? "image" : "none")} active={bgMode !== "none"} title="Virtual Background" activeColor="#9333ea">
                        <span style={{ fontSize: "16px" }}>🖼️</span>
                    </CtrlBtn>
                    {/* Noise Cancellation */}
                    <CtrlBtn onClick={() => setNoiseReduction(v => !v)} active={noiseReduction} title="Noise Cancel" activeColor="#22c55e">
                        <span style={{ fontSize: "16px" }}>🤫</span>
                    </CtrlBtn>
                    {/* AI Video Optimization */}
                    {isHost && (
                        <CtrlBtn onClick={() => setAiOptimizationEnabled(v => !v)} active={aiOptimizationEnabled} title="AI Call Optimizer" activeColor="#6366f1">
                            <span style={{ fontSize: "16px" }}>🚀</span>
                        </CtrlBtn>
                    )}
                    {/* End call */}
                    <button onClick={endCall} title="End call" style={{
                        width: "60px", height: "40px", borderRadius: "24px", background: "#ea4335",
                        color: "white", border: "none", display: "flex", alignItems: "center",
                        justifyContent: "center", cursor: "pointer", marginLeft: "8px"
                    }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
                    </button>
                </div>

                <div style={{ flex: 1 }} />

                <style>{`
                    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(234,67,53,0.7); } 70% { box-shadow: 0 0 0 6px rgba(234,67,53,0); } 100% { box-shadow: 0 0 0 0 rgba(234,67,53,0); } }
                    @keyframes strobeWarning { 0% { opacity:1; filter: brightness(1); } 50% { opacity:0.9; filter: brightness(1.2); } 100% { opacity:0.95; filter: brightness(0.8); } }
                    @keyframes floatUp { 0% { opacity:1; transform: translateY(0); } 100% { opacity:0; transform: translateY(-200px); } }
                    @keyframes slideUp { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
                `}</style>
            </div>

            {/* ── Remote incoming scam alert toast ── */}
            {incomingAlert && (
                <div style={{
                    position: "fixed", top: "80px", right: "20px", background: "#7f1212", border: "1px solid #ef4444",
                    borderRadius: "12px", padding: "12px 16px", color: "white", zIndex: 200,
                    boxShadow: "0 8px 32px rgba(239,68,68,0.4)", maxWidth: "300px"
                }}>
                    <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>🚨 REMOTE SCAM ALERT</div>
                    <div style={{ fontSize: "12px", color: "#fca5a5" }}>
                        Participant {incomingAlert.participantId.substring(0, 4)} has a risk score of {incomingAlert.riskScore}/100
                    </div>
                    <button onClick={() => setIncomingAlert(null)} style={{ marginTop: "8px", background: "rgba(0,0,0,0.3)", border: "none", color: "white", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", fontSize: "11px" }}>Dismiss</button>
                </div>
            )}
        </div>
    )
}

function CtrlBtn({ onClick, active, title, children, activeColor }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode; activeColor?: string
}) {
    return (
        <button onClick={onClick} title={title} aria-label={title} style={{
            width: "50px", height: "50px", borderRadius: "50%",
            background: active ? (activeColor || "#ea4335") : "#3c4043",
            color: "white", border: "none", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", transition: "background 0.2s, transform 0.1s",
            flexShrink: 0
        }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#4a4d50" }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#3c4043" }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.92)" }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}
        >
            {children}
        </button>
    )
}
