# Sequence Diagrams for Core Workflows
## Project: Online Video Meeting — A Step Towards Atma Nirbhar Bharat

### 1. User Authentication & Host Election Sequence
```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Auth as NextAuth Server Action (authActions.ts)
    participant DB as PostgreSQL (Prisma ORM)
    participant Socket as Socket.IO Server (server.js)

    User->>Auth: loginAction(email, password)
    Auth->>DB: prisma.user.findUnique({ where: { email } })
    DB-->>Auth: Return User Record (with hashed password)
    Auth->>Auth: bcrypt.compare(password, user.password)
    alt Password Invalid
        Auth-->>User: Return { error: "Invalid credentials" }
    else Password Valid
        Auth->>Auth: Create Signed JWT Session Cookie
        Auth-->>User: Return { success: true, redirect: "/meet/ROOM_ID" }
    end

    User->>Socket: emit("join-room", roomId, userId, displayName)
    Socket->>Socket: Intercept via 3-Tier WAF Middleware
    Socket->>Socket: Check if roomParticipants[roomId] is empty
    alt First Joiner in Room
        Socket->>Socket: roomHosts[roomId] = userId (Immutable Host)
        Socket-->>User: emit("host-confirmed", { isHost: true, hostUserId: userId })
    else Subsequent Joiner
        Socket-->>User: emit("host-confirmed", { isHost: false, hostUserId: roomHosts[roomId] })
    end
    Socket->>Socket: Broadcast "participants-update" to all room members
```

### 2. LiveKit SFU Dynacast Publishing & Subscription Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Participant as Joining Participant
    participant API as Next.js API (/api/livekit/get-token)
    participant SFU as LiveKit Cloud SFU
    actor RemotePeer as Remote Room Subscriber

    Participant->>API: GET /api/livekit/get-token?room=ROOM_ID&username=USER_ID
    API->>API: Sign LiveKit AccessToken with API Secret & RoomGrant
    API-->>Participant: Return { token: JWT_STRING }

    Participant->>SFU: Room.connect(wss://livekit.cloud, token)
    SFU-->>Participant: Connection Established

    Participant->>Participant: navigator.mediaDevices.getUserMedia()
    Participant->>SFU: localParticipant.publishTrack(VideoTrack, { simulcast: true })
    Participant->>SFU: localParticipant.publishTrack(AudioTrack)

    SFU->>RemotePeer: emit(RoomEvent.TrackSubscribed, VideoTrack)
    RemotePeer->>RemotePeer: Render in DOM <video> element
    
    Note over RemotePeer,SFU: Remote Peer minimizes video tile to 180p size
    RemotePeer->>SFU: Send Dynacast Layer Hint (Request 180p spatial layer)
    SFU->>Participant: Adjust RTP transmission stream to lowest simulcast layer
```

### 3. Biometric ArcFace Verification & Challenge Liveness Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Client
    participant FAPI as face-api.js (WASM ArcFace)
    participant LiveEngine as Attendance Engine (useAttendanceSystem.ts)
    participant Host as Teacher Attendance Panel

    Student->>LiveEngine: Ingest Video Frame from Canvas
    LiveEngine->>FAPI: fapi.detectSingleFace().withFaceDescriptor()
    FAPI-->>LiveEngine: Return 128-Dimensional Embedding E_current

    LiveEngine->>LiveEngine: Compute CosineSim(E_current, E_enrolled)
    alt CosineSim >= 0.65 (Identity Match)
        LiveEngine->>LiveEngine: Issue Dynamic Liveness Challenge (e.g. "turn_left")
        LiveEngine->>Student: Render UI Prompt: "Please turn head left within 4s"
        
        loop Monitoring 4-Second Window
            LiveEngine->>LiveEngine: Track HeadPose yaw < -18 degrees
        end

        alt Challenge Succeeded in Time
            LiveEngine->>LiveEngine: Mark Record { status: "PRESENT", result: "PASS" }
            LiveEngine->>Host: Sync Live Attendance Update via Socket
        else Timeout Expired
            LiveEngine->>LiveEngine: Mark Record { status: "AWAY", result: "FAIL" }
        end
    else CosineSim < 0.65 (Face Mismatch / Impersonation)
        LiveEngine->>LiveEngine: Log "face_mismatch" strike
    end
```
