# Data Flow Diagrams (DFD) — Level 0, Level 1 & Level 2
## Project: Online Video Meeting — A Step Towards Atma Nirbhar Bharat

---

### 1. Level 0 Context Data Flow Diagram (DFD)
```
                                 +-------------------------------+
                                 | 1. Credentials / Registration |
                                 | 2. Meeting Parameters         |
                                 | 3. Raw Media Streams          |
                                 | 4. Whiteboard / Chat / Polls  |
                                 +---------------+---------------+
                                                 |
                                                 v
+------------------------+          +------------------------+          +------------------------+
|                        |          |                        |          |                        |
|      PARTICIPANT       | <======> |       MEET-CLONE       | <======> |     HOST / PROCTOR     |
|   (Student/Candidate)  |          | SOVEREIGN VIDEO SYSTEM |          |  (Teacher/Interviewer) |
|                        |          |                        |          |                        |
+------------------------+          +-----------+------------+          +------------------------+
                                                |
                                                v
                                 +-------------------------------+
                                 | 1. Real-time Proctoring Alerts|
                                 | 2. Engagement / Fluency Logs  |
                                 | 3. Gradebook & PDF Workbooks  |
                                 +-------------------------------+
```

---

### 2. Level 1 Data Flow Diagram (Functional Subsystem Decomposition)
```
  [User Inputs / Stream]
            │
            ▼
   ( 1.0 User Authentication ) ──────► [ Store Session JWT ] ──────► [ D1: User DB ]
            │
            ▼
   ( 2.0 Room Lobby & Diagnostics ) ──► [ Verify Media Devices & Token ]
            │
            ▼
   ( 3.0 3-Tier Security & WAF ) <────> [ D2: Rate Limits & Blacklist ]
            │
            ├─────────────────────────────────────────┐
            ▼                                         ▼
   ( 4.0 LiveKit SFU Routing )               ( 5.0 Edge AI Analytics )
     - Adaptive Simulcast                      - ARENA Congestion Optimizer
     - Dynacast Viewport Subscriptions         - CHRONOS Cognitive Gap Engine
     - Sub-150ms RTP Relaying                  - ArcFace Liveness Verification
            │                                  - Whisper Speech Transcription
            └────────────────────┬────────────────────┘
                                 │
                                 ▼
                     ( 6.0 Report Synthesizer )
                                 │
                                 ▼
                     [ D3: Meeting & Metrics DB ]
                                 │
                                 ▼
                    [ Signed PDF / XLSX Exports ]
```

---

### 3. Level 2 DFD: Multimodal AI Proctoring Subsystem
```
 [Raw WebRTC Video Track] ──────► ( 5.1 MediaPipe Landmark Extractor )
                                              │
                                              ▼
                                    [ 478 3D Mesh Points ]
                                              │
                                              ▼
                                    ( 5.2 CHRONOS Engine )
                                      - Blink Suppression Analysis
                                      - Gaze Dispersion Variance
                                      - Head Freeze Extraction
                                              │
                                              ├────────► [ Measured Cognitive Load ]
                                              │
 [Active Question Difficulty] ────────────────┤
                                              ▼
                                    ( 5.3 Gap Comparator )
                                      - Gap = Expected - Measured
                                              │
                                              ▼
                                    ( 5.4 Bayesian Fusion ) <─── [ Spectral Voice Stress ]
                                      - Likelihood Ratio Updates <─── [ Prohibited Object (YOLO) ]
                                      - Session Prior Escalation <─── [ Tab-Switch Monitor ]
                                              │
                                              ▼
                                    ( 5.5 4-State HMM )
                                      - Viterbi Trellis Path
                                      - State: FOCUSED/SUSPICIOUS/CHEATING
                                              │
                                              ▼
                                    ( 5.6 WAF Event Dispatcher ) ──► [ Host Socket Event ]
```
