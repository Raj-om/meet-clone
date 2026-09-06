# ONLINE VIDEO MEETING: A STEP TOWARDS ATMA NIRBHAR BHARAT
## VTU Major Project Supporting Diagrams & Technical Schematics

### 1. Overall System Architecture
```mermaid
graph TB
    subgraph Client_Layer["Client Tier (Next.js 16 + React 19 Client SPA)"]
        UI["User Interface (Video Grid, Controls, Sidebars)"]
        LocalMedia["Media Capture & Preprocessing (WebRTC MediaStream)"]
        ClientAI["Client-Side AI Engine (MediaPipe, ONNX Runtime, TF.js, Web Workers)"]
        StateEngine["State Management & Event Bus (useNervousSystem)"]
    end

    subgraph Security_Firewall["3-Tier Security & Behavioral Firewall"]
        L1["Layer 1: Network & TLS Encryption (HTTPS/WSS)"]
        L2["Layer 2: Application WAF (Deep Payload Sanitization & XSS Stripping)"]
        L3["Layer 3: Behavioral AI Firewall (IP Blacklisting & Anti-Brute-Force)"]
    end

    subgraph Application_Server["Application Server Tier (Node.js + Socket.IO + Next.js Server Actions)"]
        Signaling["Socket.IO Signaling & Real-Time Event Dispatcher"]
        AuthServer["NextAuth v5 (JWT & Credentials / Google OAuth Provider)"]
        HostAuthority["Server-Authoritative Host & Role Registry"]
        RateLimiter["Event-Specific Leaky-Bucket Rate Limiter"]
    end

    subgraph Media_Infrastructure["Media Infrastructure Tier"]
        LiveKitSFU["LiveKit Cloud SFU (Enterprise Adaptive Stream & Dynacast)"]
        STUNTURN["STUN / TURN Relays (RFC 5389 / RFC 5766)"]
    end

    subgraph AI_Microservice["Microservice AI Tier (Python Flask Service :5001)"]
        DIRE["DIRE ResNet-50 Feature Error Extractor"]
        DCT["2D-DCT Power Spectrum Frequency Analyzer"]
        ColorDist["Color Distribution & Artifact Classifier"]
    end

    subgraph Database_Tier["Data Persistence Tier (PostgreSQL + Prisma ORM)"]
        PrismaORM["Prisma Client v6.19"]
        PostgreSQL[("PostgreSQL Relational DB (Users, Meetings, Metrics, Logs)")]
    end

    UI --> LocalMedia
    LocalMedia --> ClientAI
    ClientAI --> StateEngine
    StateEngine --> UI

    UI <--> L1
    L1 <--> L2
    L2 <--> L3
    L3 <--> Signaling
    L3 <--> AuthServer

    LocalMedia <--> LiveKitSFU
    LiveKitSFU <--> STUNTURN

    ClientAI <--> DIRE
    ClientAI <--> DCT

    AuthServer <--> PrismaORM
    Signaling <--> HostAuthority
    HostAuthority <--> PrismaORM
    PrismaORM <--> PostgreSQL
```

### 2. ARENA Bitrate & Congestion Optimization Architecture
```mermaid
graph LR
    subgraph Inputs["Network & Semantic Telemetry"]
        RTT["RTT History (10-sample sliding window)"]
        Jitter["Jitter Variance"]
        Face["Facial Blendshapes & Head Pose"]
        Speaker["Active Speaker Status"]
        Engagement["Engagement Score (0-100)"]
    end

    subgraph Module1["Module 1: LSTM Predictor"]
        D1["1st Order Derivative (RTT Velocity)"]
        D2["2nd Order Derivative (RTT Acceleration)"]
        Sigmoid["Sigmoid Activation -> Congestion Prob P_c"]
    end

    subgraph Module2["Module 2: Context Scorer"]
        ContextScore["Content Importance Score (0.0 - 1.0)"]
    end

    subgraph Module3["Module 3: Bayesian Optimizer"]
        Thompson["Thompson Sampling (mu, sigma^2 Normal Dist)"]
        BitrateTarget["Optimal Target Bitrate B*(t)"]
    end

    subgraph Module4["Module 4: Topology Scheduler"]
        Softmax["Softmax Tournament Weighting"]
        UplinkDist["Proportional Uplink Bandwidth Allocation"]
    end

    RTT --> D1 --> D2 --> Sigmoid
    Jitter --> Sigmoid
    Face --> ContextScore
    Speaker --> ContextScore
    Engagement --> ContextScore

    Sigmoid --> Thompson
    ContextScore --> Thompson
    Thompson --> BitrateTarget

    BitrateTarget --> Softmax
    Engagement --> Softmax
    Softmax --> UplinkDist
```

### 3. CHRONOS Cognitive Gap & Exam Integrity Pipeline
```mermaid
sequenceDiagram
    autonumber
    actor Student as Candidate / Student
    participant Video as Camera & Canvas Pipeline
    participant MP as MediaPipe Vision Engine
    participant CHRONOS as Cognitive Gap Algorithm
    participant Bayes as Bayesian Risk Engine
    participant HMM as 4-State HMM (Viterbi)
    participant Socket as Socket.IO Security Relay
    actor Invigilator as Invigilator / Proctor

    Student->>Video: Transmits Live Video Frames (30 FPS)
    Video->>MP: Detect 478 3D Facial Landmarks & Blendshapes
    MP->>CHRONOS: Telemetry (Blink Rate, Gaze Variance, Head Freeze)
    CHRONOS->>CHRONOS: Compute Measured Cognitive Load (MCL)
    CHRONOS->>CHRONOS: Evaluate Gap = Expected Complexity (EC) - MCL
    alt Gap > Anomaly Threshold (0.55)
        CHRONOS->>Bayes: Flag "Hidden AI Co-pilot" (Likelihood Ratio = 15.0)
    end
    Bayes->>Bayes: Bayesian Odds Update: Odds = Prior * Product(LR)
    Bayes->>HMM: Feed Smoothed Risk Posterior (0-100)
    HMM->>HMM: Viterbi Sequence Decoding
    Note over HMM: State Transitions: FOCUSED -> DISTRACTED -> SUSPICIOUS -> CHEATING
    alt State == CHEATING or Posterior > 75
        HMM->>Socket: Emit "exam-violation" { type, severity, telemetry }
        Socket->>Invigilator: Live Alert & Audit Log Updated
    end
```
