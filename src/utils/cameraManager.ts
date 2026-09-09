"use client"

/**
 * Global Camera Manager
 * 
 * Prevents the camera hardware from shutting down during Next.js route transitions 
 * or component unmounts by maintaining a singleton MediaStream.
 */
class CameraManager {
    private static instance: CameraManager;
    private stream: MediaStream | null = null;
    private acquiringPromise: Promise<MediaStream> | null = null;
    
    private constructor() {}
    
    static getInstance() {
        if (!CameraManager.instance) {
            CameraManager.instance = new CameraManager();
        }
        return CameraManager.instance;
    }
    
    /**
     * Acquires the camera and microphone stream.
     * If already acquired and active, returns the existing stream instantly.
     */
    async getStream(): Promise<MediaStream> {
        // If we already have an active stream, return it immediately
        if (this.stream && this.stream.active) {
            const hasVideo = this.stream.getVideoTracks().some(t => t.readyState === 'live');
            if (hasVideo) return this.stream;
        }

        // Prevent race conditions where multiple components request simultaneously
        if (this.acquiringPromise) {
            return this.acquiringPromise;
        }

        this.acquiringPromise = new Promise(async (resolve, reject) => {
            try {
                let s: MediaStream | null = null;
                // Strategy 1: User-facing camera + noise-suppressed audio
                try {
                    s = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: "user" }, 
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                    });
                } catch (e1) {
                    // Strategy 2: Default video + default audio (standard webcams on PC)
                    try {
                        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    } catch (e2) {
                        // Strategy 3: Video only (in case mic has strict constraints)
                        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    }
                }

                // If microphone wasn't included or was dropped by browser, attempt standalone audio acquisition
                if (s && s.getAudioTracks().length === 0) {
                    try {
                        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
                        audioOnly.getAudioTracks().forEach(track => s!.addTrack(track));
                    } catch (audioErr) {
                        console.warn("CameraManager: Microphone not available or denied:", audioErr);
                    }
                }

                this.stream = s;
                resolve(s);
            } catch (err) {
                console.error("CameraManager: Failed to acquire media", err);
                reject(err);
            } finally {
                this.acquiringPromise = null;
            }
        });

        return this.acquiringPromise;
    }
    
    /**
     * Explicitly stops the camera tracks. Only call this when leaving the meeting entirely.
     */
    stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }
}

export const cameraManager = CameraManager.getInstance();
