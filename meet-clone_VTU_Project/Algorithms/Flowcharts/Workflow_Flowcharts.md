# Formal Workflow Flowcharts
## Project: Online Video Meeting — A Step Towards Atma Nirbhar Bharat

### 1. Overall System Initialization & Authentication Flowchart
```
  [ Start ]
      │
      ▼
  [ User Enters Credentials / Google OAuth ]
      │
      ▼
  [ Query PostgreSQL via Prisma Client ]
      │
  ┌───┴──────────────────────────────┐
  ▼                                  ▼
[ Valid Credentials? ]        [ Invalid Credentials ]
  │ (Yes)                            │
  ▼                                  ▼
[ Issue NextAuth JWT Token ]  [ Render 401 Error ]
  │                                  │
  ▼                                  ▼
[ Redirect to Meeting Lobby ]     [ End ]
      │
      ▼
[ Initialize Media Diagnostics ]
      │
      ▼
[ Join Meeting Room ]
      │
      ▼
   [ End ]
```

### 2. ARENA Congestion & Bitrate Optimization Flowchart
```
  [ Start: Every 1000ms RTT Sample ]
      │
      ▼
  [ Ingest Sample: RTT, Jitter, PacketLoss ]
      │
      ▼
  [ Calculate 1st Derivative: Velocity d1 = ΔRTT ]
      │
      ▼
  [ Calculate 2nd Derivative: Acceleration d2 = Δ²RTT ]
      │
      ▼
  [ Ingest Context: Blendshapes, Head Pose, Speaker Status ]
      │
      ▼
  [ Compute Sigmoid Congestion Probability P_c ]
      │
  ┌───┴──────────────────────────────┐
  ▼                                  ▼
< P_c > 0.55 ? >               < P_c <= 0.55 ? >
  │ (Yes)                            │ (No)
  ▼                                  ▼
[ Preemptively Reduce Bitrate ]  [ Thompson Sampling: Explore High Bitrate ]
  │                                  │
  └──────────────────┬───────────────┘
                     ▼
  [ Apply Clamped Bitrate to Local WebRTC Publishing Track ]
                     │
                     ▼
  [ Update Bayesian Running Mean μ and Variance σ² ]
                     │
                     ▼
                  [ End ]
```

### 3. CHRONOS Cognitive Gap Anomaly Detection Flowchart
```
  [ Start: Live Video Frame ]
      │
      ▼
  [ MediaPipe: Extract 478 3D Facial Landmarks & Blendshapes ]
      │
      ▼
  [ Measure Blink Rate Suppression (BlinkStrain) ]
      │
      ▼
  [ Measure Gaze Spatial Variance (Tunnel Vision) ]
      │
      ▼
  [ Measure Head Micromovement Freezing ]
      │
      ▼
  [ Calculate Measured Cognitive Load: MCL = 0.4*Blink + 0.4*Gaze + 0.2*Head ]
      │
      ▼
  [ Retrieve Expected Complexity (EC) from Active Question ]
      │
      ▼
  [ Calculate Cognitive Gap = Max(0, EC - MCL) ]
      │
  ┌───┴──────────────────────────────┐
  ▼                                  ▼
< Gap > 0.55 (Anomaly Threshold) ? >
  │ (Yes)                            │ (No)
  ▼                                  ▼
[ Flag "Hidden AI Co-pilot" ]     [ Log Normal Congruence ]
  │                                  │
  ▼                                  ▼
[ Escalate to Bayesian Engine ]   [ Continue Monitoring ]
  │                                  │
  ▼                                  ▼
[ Update 4-State HMM Trellis ]       │
  │                                  │
  ▼                                  │
[ Emit Alert to Invigilator ]        │
  │                                  │
  └──────────────────┬───────────────┘
                     ▼
                  [ End ]
```
