# Source Code Traceability & Implementation Mapping Matrix
## Project: Online Video Meeting — A Step Towards Atma Nirbhar Bharat

This document provides a precise line-by-line traceability mapping connecting every academic requirement, algorithm, and feature to the actual implementation codebase located at `C:\Users\DELL\OneDrive\Desktop\meet-clone`.

---

| System Subsystem | Source File Path | Key Classes / Functions | Exact Purpose & Algorithmic Role |
| :--- | :--- | :--- | :--- |
| **Server & WAF Firewall** | `server.js` | `createServer()`, `isRateLimited()`, `isVerifiedHost()` | Node.js HTTP server, 3-Tier WAF, Socket.IO signaling, host authority. |
| **Authentication Backend**| `src/auth.ts` | `NextAuth()`, `CredentialsProvider`, `GoogleProvider` | NextAuth v5 JWT session generation, password hashing verification. |
| **Auth Server Actions** | `src/app/actions/authActions.ts` | `loginAction()`, `registerAction()` | Next.js Server Actions for user registration and login with bcrypt. |
| **Database Schema** | `prisma/schema.prisma` | `model User`, `model Meeting`, `model ExamResult` | PostgreSQL relational schema definitions and Prisma ORM configuration. |
| **WebRTC / SFU Hook** | `src/hooks/useWebRTC.ts` | `useWebRTC()`, `connectToLiveKit()`, `updateRemoteStreams()` | LiveKit SFU connection, track publishing, W3C MediaStream bridging. |
| **ARENA Optimizer Engine**| `src/utils/ArenaAlgorithm.ts` | `ArenaCongestionPredictor`, `ArenaBayesianOptimizer` | 1st/2nd-order RTT derivative calculation, Thompson sampling bitrate selection. |
| **ARENA Client Hook** | `src/hooks/useArenaNetwork.ts` | `useArenaNetwork()` | Real-time network telemetry feed, track bitrate throttling adapter. |
| **CHRONOS Cognitive Gap** | `src/utils/CognitiveGapAlgorithm.ts` | `CognitiveGapAlgorithm.observe()`, `evaluateGap()` | Blink suppression, gaze tunnel vision, and cognitive gap computation. |
| **Cognitive Gap Hook** | `src/hooks/useCognitiveGap.ts` | `useCognitiveGap()` | Telemetry consumer bridging MediaPipe vision to the CHRONOS engine. |
| **Bayesian Risk Engine** | `src/utils/BayesianRiskEngine.ts` | `BayesianRiskEngine.predict()`, `onViolation()` | Likelihood ratio sensor fusion with session prior updates and EMA smoothing. |
| **Behavioral HMM** | `src/utils/HiddenMarkovModel.ts` | `HiddenMarkovModel.viterbi()`, `observe()` | 4-State Viterbi trajectory decoding (`FOCUSED` $\rightarrow$ `CHEATING`). |
| **Behavioral LSTM Hook** | `src/hooks/useLSTMBehavior.ts` | `useLSTMBehavior()` | Web Worker pipeline tracking temporal student posture sequences. |
| **Isolation Forest Engine**| `src/utils/IsolationForest.ts` | `IsolationForest.fit()`, `score()` | Pure-JS 100-tree binary partitioning for outlier anomaly detection. |
| **Random Forest Ensemble** | `src/utils/RandomForest.ts` | `RandomForest.predict()`, `DecisionTree` | Pre-trained 5-tree decision ensemble for multimodal scam scoring. |
| **Online SGD Learner** | `src/utils/OnlineLearner.ts` | `OnlineLearner.update()`, `predict()` | Stochastic Gradient Descent with Nesterov momentum for personal calibration. |
| **Biometric Attendance** | `src/hooks/useAttendanceSystem.ts`| `useAttendanceSystem()`, `loadFaceAPI()`, `cosineSim()` | ArcFace 128-D embedding extraction & interactive challenge liveness tests. |
| **Deepfake Microservice** | `deepfake_server/app.py` | `analyze_dct_spectrum()`, `dct_to_score()` | Python Flask service analyzing 2D-DCT frequency power spectrum roll-off. |
| **Silero VAD Hook** | `src/hooks/useSileroVAD.ts` | `useSileroVAD()`, `initSilero()` | ONNX Runtime Web execution of Silero neural Voice Activity Detection. |
| **Whisper Web Worker** | `src/workers/whisperWorker.ts` | `pipeline("automatic-speech-recognition")` | Background Transformers.js execution of Whisper ASR subtitles. |
| **Exam Session Hook** | `src/hooks/useExamSession.ts` | `useExamSession()`, `recordViolation()` | Complete examination state machine, question sequencing, and strike logs. |
| **Specialized Dashboards**| `src/components/` | `InvigilatorDashboard`, `ClassroomDashboard`, `InterviewerDashboard` | Role-specific analytics, student heatmaps, and exam proctoring grids. |
| **Document Generator** | `src/utils/documentGenerator.ts`| `generatePDF()`, `generateDocx()`, `generateExcel()` | Multi-format meeting minutes and gradebook workbook export. |
