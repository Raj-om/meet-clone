# 🎓 EduVision AI - Next-Gen Video Conferencing
> **A Highly Scalable, AI-Powered Video Conferencing Platform Built for Academia.**

EduVision AI is not just another Zoom clone. It is a strictly proctored, enterprise-grade classroom environment built to solve the modern challenges of remote education: **Plagiarism, Deepfake Impersonation, and Student Engagement.**

Powered by a globally distributed **LiveKit SFU Architecture** and local **Python Machine Learning models**, this platform ensures high-fidelity 100+ participant scaling alongside military-grade academic integrity tracking.

---

## 🚀 Enterprise Architecture
*   **Video Engine:** LiveKit Selective Forwarding Unit (SFU)
*   **Web Framework:** Next.js 15 (React 19)
*   **Database:** Neon Serverless PostgreSQL
*   **Authentication:** NextAuth (Strict Email/Password Middleware)
*   **Machine Learning:** TensorFlow.js + Local Python Transformers (DeepSeek-R1)

---

## 🧠 The 3 AI Modes

### 1. 📝 Exam Mode (Strict Proctoring)
A zero-tolerance academic integrity environment.
*   **Deepfake Detection:** Scans webcam feeds against known AI-generated face markers.
*   **Multiple-Face Detection:** Alerts the examiner if a second person enters the frame.
*   **Hardware Proctoring:** Strict tab-switch and screen-focus tracking.
*   **Academic Integrity Report:** 1-click export to a professional **PDF/Excel Grading Sheet** containing Plagiarism Risk % and timestamps of all violations.

### 2. 🎤 Interview Mode (Behavioral Analysis)
An HR and mock-interview tool for assessing student readiness.
*   **Voice Stress Analysis:** Analyzes vocal tremors to gauge nervousness.
*   **Eye Contact Tracking:** Computes a confidence score based on gaze alignment.
*   **Candidate Scorecard:** Instantly exports a PDF detailing silence periods, confidence metrics, and custom examiner flags.

### 3. 👨‍🏫 Classroom Mode (Engagement Analytics)
Designed for massive lectures.
*   **Attention Heatmaps:** The Teacher's God Mode Dashboard provides a live grid of student engagement scores.
*   **Blink-Rate Focus Scoring:** Measures actual screen-gazing time.
*   **Live Metrics:** Generates an Excel Attendance Sheet containing aggregate attention scores at the end of the session.

---

## 🤖 Decentralized AI Tutor (DeepSeek-R1)
Built directly into the classroom chat is an offline, privacy-first AI Tutor powered by **DeepSeek-R1** (running via Ollama). 
Because the AI runs locally and communicates via P2P WebRTC data channels, students can ask highly complex IIT GATE math questions without incurring expensive OpenAI cloud API costs.

---

## ⚙️ How to Run Locally

We have created a 1-click bootloader that launches the Next.js Server, the Python ML API, and the Ollama LLM Engine simultaneously.

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file containing your database and LiveKit keys:
   ```env
   DATABASE_URL="postgresql://neondb_owner:..."
   LIVEKIT_URL="wss://your-project.livekit.cloud"
   LIVEKIT_API_KEY="..."
   LIVEKIT_API_SECRET="..."
   ```

3. **Start the Platform:**
   ```bash
   npm run dev
   ```

4. **Access:**
   Navigate to `http://localhost:3000`. You will be required to create an account as the Next.js Middleware strictly protects all meeting instances.

---

*Developed for the Final Year Major Project Presentation - 2026*
