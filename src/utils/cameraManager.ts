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
                const s = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "user" }, 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
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
