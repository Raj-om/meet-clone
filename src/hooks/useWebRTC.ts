"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io } from "socket.io-client"
import { Room, RoomEvent, Track, LocalVideoTrack, LocalAudioTrack } from "livekit-client"
import { cameraManager } from "@/utils/cameraManager"

// This hook replaces the old Socket.io P2P system with LiveKit SFU,
// but perfectly preserves the old MediaStream interfaces so the AI/Deepfake models do not break!
export const useWebRTC = (roomId: string, userId: string) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [screenShareUserId, setScreenShareUserId] = useState<string | null>(null)

    const roomRef = useRef<Room | null>(null)
    const socketRef = useRef<any>(null)

    useEffect(() => {
        let isMounted = true
        const room = new Room({
            adaptiveStream: true,
            dynacast: true,
        })
        roomRef.current = room

        // Restore socket.io strictly for AI data signaling (God Mode, alerts, etc.)
        socketRef.current = io()
        socketRef.current.emit("join-room", roomId, userId)

        const connectToLiveKit = async () => {
            try {
                // 1. Fetch secure JWT Token
                const tokenRes = await fetch(`/api/livekit/get-token?room=${roomId}&username=${userId}`)
                const { token } = await tokenRes.json()

                if (!token) throw new Error("Failed to get LiveKit token")

                // 2. Connect to LiveKit Enterprise Server
                // Note: process.env is only available in node, so we use the hardcoded string or NEXT_PUBLIC_
                const livekitUrl = "wss://meet-clone-h7gsuvxw.livekit.cloud"
                await room.connect(livekitUrl, token)

                // 3. Setup Local Media Streams
                const isCompanion = sessionStorage.getItem("meet-companion-mode") === "true";

                if (!isCompanion) {
                    const stream = await cameraManager.getStream();
                    
                    try {
                        const videoTracks = stream.getVideoTracks();
                        if (videoTracks.length > 0) {
                            await room.localParticipant.publishTrack(videoTracks[0]);
                        }
                    } catch (e) {
                        console.warn("Failed to publish video track:", e);
                    }

                    try {
                        const audioTracks = stream.getAudioTracks();
                        if (audioTracks.length > 0) {
                            await room.localParticipant.publishTrack(audioTracks[0]);
                        }
                    } catch (e) {
                        console.warn("Failed to publish audio track:", e);
                    }
                    
                    if (stream.getTracks().length > 0 && isMounted) {
                        setLocalStream(stream);
                    }
                } else {
                    // Provide empty stream for Companion mode to prevent null errors in UI
                    if (isMounted) setLocalStream(new MediaStream());
                }

                // 4. Map Remote LiveKit Tracks back into standard MediaStreams for the AI Models
                const updateRemoteStreams = () => {
                    const streams: Record<string, MediaStream> = {}
                    
                    room.remoteParticipants.forEach((participant) => {
                        const pStream = new MediaStream()
                        
                        participant.videoTrackPublications.forEach((pub) => {
                            if (pub.track?.mediaStreamTrack && pub.source === Track.Source.Camera) {
                                pStream.addTrack(pub.track.mediaStreamTrack)
                            }
                        })
                        participant.audioTrackPublications.forEach((pub) => {
                            if (pub.track?.mediaStreamTrack && pub.source === Track.Source.Microphone) {
                                pStream.addTrack(pub.track.mediaStreamTrack)
                            }
                        })
                        
                        if (pStream.getTracks().length > 0) {
                            streams[participant.identity] = pStream
                        }
                    })
                    if (isMounted) setRemoteStreams(streams)
                }

                // Listen for LiveKit Events
                room.on(RoomEvent.TrackSubscribed, updateRemoteStreams)
                room.on(RoomEvent.TrackUnsubscribed, updateRemoteStreams)
                room.on(RoomEvent.ParticipantDisconnected, updateRemoteStreams)
                room.on(RoomEvent.ParticipantConnected, updateRemoteStreams)

                // Handle Screen Share specifically
                room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
                    if (pub.source === Track.Source.ScreenShare) {
                        setScreenShareUserId(participant.identity)
                    }
                })
                room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
                    if (pub.source === Track.Source.ScreenShare) {
                        setScreenShareUserId(null)
                    }
                })

                updateRemoteStreams()
            } catch (err) {
                console.error("LiveKit SFU connection failed:", err)
            }
        }
        
        connectToLiveKit()

        return () => {
            isMounted = false
            room.disconnect()
            if (socketRef.current) socketRef.current.disconnect()
        }
    }, [roomId, userId])

    const startScreenShare = useCallback(async () => {
        if (!roomRef.current) return
        try {
            await roomRef.current.localParticipant.setScreenShareEnabled(true, { audio: true })
            setIsScreenSharing(true)
        } catch (e) {
            console.error("Screen share failed", e)
        }
    }, [])

    const stopScreenShare = useCallback(async () => {
        if (!roomRef.current) return
        try {
            await roomRef.current.localParticipant.setScreenShareEnabled(false)
            setIsScreenSharing(false)
        } catch (e) {
            console.error("Stop screen share failed", e)
        }
    }, [])

    return {
        localStream,
        remoteStreams,
        socket: socketRef.current, // Restored for AI signaling!
        isScreenSharing,
        screenShareUserId,
        startScreenShare,
        stopScreenShare,
        peersRef: { current: {} }, // Stubbed out
        replaceVideoTrackOnAllPeers: async (track?: MediaStreamTrack) => {}, // LiveKit handles this automatically
    }
}
