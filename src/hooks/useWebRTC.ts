"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { cameraManager } from "@/utils/cameraManager"

const ICE_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        // Public Free TURN Relays for mobile carriers and restrictive Wi-Fi NAT traversal
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],
    iceCandidatePoolSize: 10,
}

export const useWebRTC = (roomId: string, userId: string) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [screenShareUserId, setScreenShareUserId] = useState<string | null>(null)

    const socketRef = useRef<Socket | null>(null)
    const peersRef = useRef<Record<string, RTCPeerConnection>>({})
    const localStreamRef = useRef<MediaStream | null>(null)
    const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({})

    // Helper to replace video track across all active WebRTC peers
    const replaceVideoTrackOnAllPeers = useCallback(async (track?: MediaStreamTrack) => {
        if (!track) return
        for (const [peerId, pc] of Object.entries(peersRef.current)) {
            try {
                const senders = pc.getSenders()
                const videoSender = senders.find(s => s.track && s.track.kind === "video")
                if (videoSender) {
                    await videoSender.replaceTrack(track)
                }
            } catch (err) {
                console.warn(`[WebRTC] Failed to replace track for peer ${peerId}:`, err)
            }
        }
    }, [])

    const createPeerConnection = useCallback((targetUserId: string, socket: Socket): RTCPeerConnection => {
        if (peersRef.current[targetUserId]) {
            return peersRef.current[targetUserId]
        }

        const pc = new RTCPeerConnection(ICE_CONFIG)
        peersRef.current[targetUserId] = pc

        // Attach local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                try {
                    pc.addTrack(track, localStreamRef.current!)
                } catch (e) {
                    console.warn("[WebRTC] Track already added to peer:", e)
                }
            })
        }

        // Send ICE candidate to remote peer via Socket.io
        pc.onicecandidate = (event) => {
            if (event.candidate && socket.connected) {
                socket.emit("ice-candidate", event.candidate, roomId, targetUserId, userId)
            }
        }

        // Receive remote audio/video tracks
        pc.ontrack = (event) => {
            const stream = event.streams[0] || new MediaStream([event.track])
            setRemoteStreams(prev => {
                const existing = prev[targetUserId]
                if (existing) {
                    // Avoid creating new MediaStream reference if track already exists
                    if (!existing.getTracks().some(t => t.id === event.track.id)) {
                        existing.addTrack(event.track)
                    }
                    return { ...prev, [targetUserId]: existing }
                }
                return { ...prev, [targetUserId]: stream }
            })
        }

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Peer ${targetUserId} state:`, pc.connectionState)
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
                // Connection dropped
            }
        }

        return pc
    }, [roomId, userId])

    useEffect(() => {
        let isMounted = true
        const socket = io()
        socketRef.current = socket

        // Initialize local camera
        const initCamera = async () => {
            const isCompanion = typeof window !== "undefined" && sessionStorage.getItem("meet-companion-mode") === "true"
            if (isCompanion) {
                const empty = new MediaStream()
                localStreamRef.current = empty
                if (isMounted) setLocalStream(empty)
                return
            }

            try {
                const stream = await cameraManager.getStream()
                localStreamRef.current = stream
                if (isMounted) setLocalStream(stream)

                // If peers already connected before camera was ready, attach tracks now
                for (const pc of Object.values(peersRef.current)) {
                    stream.getTracks().forEach(track => {
                        try {
                            pc.addTrack(track, stream)
                        } catch (e) {
                            console.warn(e)
                        }
                    })
                }
            } catch (err) {
                console.warn("[WebRTC] Direct camera access error:", err)
            }
        }

        initCamera()

        // Socket Join
        const displayName = (typeof window !== "undefined" ? sessionStorage.getItem("meet-display-name") : null) || "Guest"
        socket.emit("join-room", roomId, userId, displayName)

        // When a new remote user connects: We are the caller, initiate Offer
        socket.on("user-connected", async (newUserId: string) => {
            if (newUserId === userId) return
            console.log(`[WebRTC] User connected: ${newUserId}, creating offer...`)

            try {
                const pc = createPeerConnection(newUserId, socket)
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                })
                await pc.setLocalDescription(offer)
                socket.emit("offer", offer, roomId, newUserId, userId)
            } catch (err) {
                console.error("[WebRTC] Error creating offer:", err)
            }
        })

        // When receiving an offer: We are the callee, create Answer
        socket.on("offer", async (offer: any, targetId: string, senderId: string) => {
            if (targetId !== userId) return
            console.log(`[WebRTC] Received offer from ${senderId}`)

            try {
                const pc = createPeerConnection(senderId, socket)
                await pc.setRemoteDescription(new RTCSessionDescription(offer))

                // Apply any queued candidates
                if (pendingCandidates.current[senderId]) {
                    for (const cand of pendingCandidates.current[senderId]) {
                        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn)
                    }
                    delete pendingCandidates.current[senderId]
                }

                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.emit("answer", answer, roomId, senderId, userId)
            } catch (err) {
                console.error("[WebRTC] Error answering offer:", err)
            }
        })

        // When receiving an answer
        socket.on("answer", async (answer: any, targetId: string, senderId: string) => {
            if (targetId !== userId) return
            console.log(`[WebRTC] Received answer from ${senderId}`)

            try {
                const pc = peersRef.current[senderId]
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer))

                    // Apply any queued candidates
                    if (pendingCandidates.current[senderId]) {
                        for (const cand of pendingCandidates.current[senderId]) {
                            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn)
                        }
                        delete pendingCandidates.current[senderId]
                    }
                }
            } catch (err) {
                console.error("[WebRTC] Error setting remote answer:", err)
            }
        })

        // When receiving ICE candidate
        socket.on("ice-candidate", async (candidate: any, targetId: string, senderId: string) => {
            if (targetId !== userId) return

            try {
                const pc = peersRef.current[senderId]
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate))
                } else {
                    // Queue candidate until remote description is set
                    if (!pendingCandidates.current[senderId]) {
                        pendingCandidates.current[senderId] = []
                    }
                    pendingCandidates.current[senderId].push(candidate)
                }
            } catch (err) {
                console.warn("[WebRTC] Error adding ICE candidate:", err)
            }
        })

        // User disconnected
        socket.on("user-disconnected", (leftUserId: string) => {
            console.log(`[WebRTC] User disconnected: ${leftUserId}`)
            if (peersRef.current[leftUserId]) {
                peersRef.current[leftUserId].close()
                delete peersRef.current[leftUserId]
            }
            delete pendingCandidates.current[leftUserId]
            setRemoteStreams(prev => {
                const next = { ...prev }
                delete next[leftUserId]
                return next
            })
        })

        // Screen share events
        socket.on("screen-share-started", (senderUserId: string) => {
            setScreenShareUserId(senderUserId)
        })
        socket.on("screen-share-stopped", () => {
            setScreenShareUserId(null)
        })

        return () => {
            isMounted = false
            socket.disconnect()
            for (const pc of Object.values(peersRef.current)) {
                pc.close()
            }
            peersRef.current = {}
        }
    }, [roomId, userId, createPeerConnection])

    const startScreenShare = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            const videoTrack = stream.getVideoTracks()[0]
            await replaceVideoTrackOnAllPeers(videoTrack)
            setIsScreenSharing(true)
            if (socketRef.current) socketRef.current.emit("screen-share-started", roomId, userId)

            videoTrack.onended = () => {
                stopScreenShare()
            }
        } catch (e) {
            console.error("Screen share error:", e)
        }
    }, [replaceVideoTrackOnAllPeers, roomId, userId])

    const stopScreenShare = useCallback(async () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0]
            if (videoTrack) {
                await replaceVideoTrackOnAllPeers(videoTrack)
            }
        }
        setIsScreenSharing(false)
        if (socketRef.current) socketRef.current.emit("screen-share-stopped", roomId, userId)
    }, [replaceVideoTrackOnAllPeers, roomId, userId])

    return {
        localStream,
        remoteStreams,
        socket: socketRef.current,
        isScreenSharing,
        screenShareUserId,
        startScreenShare,
        stopScreenShare,
        peersRef,
        replaceVideoTrackOnAllPeers,
    }
}
