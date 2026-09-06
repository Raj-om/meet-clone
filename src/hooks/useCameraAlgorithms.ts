"use client"

import { useEffect, useRef, useState } from "react"

export interface CameraAlgorithmsOptions {
    autoFraming?: boolean;
    lowLightEnhancement?: boolean;
}

/**
 * useCameraAlgorithms
 * 
 * Intercepts a raw MediaStream and applies advanced algorithms like Auto-Framing 
 * (via FaceDetector) and Low-Light Enhancement (via Canvas filtering) in real-time.
 */
export const useCameraAlgorithms = (
    rawStream: MediaStream | null,
    options: CameraAlgorithmsOptions
) => {
    const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const animationFrameRef = useRef<number>();
    
    // Auto-framing state (smoothing)
    const targetCropRef = useRef({ x: 0, y: 0, size: 1 });
    const currentCropRef = useRef({ x: 0, y: 0, size: 1 });

    useEffect(() => {
        if (!rawStream) {
            setProcessedStream(null);
            return;
        }

        const videoTrack = rawStream.getVideoTracks()[0];
        if (!videoTrack) {
            setProcessedStream(rawStream);
            return;
        }

        // If no algorithms are enabled, return the raw stream
        if (!options.autoFraming && !options.lowLightEnhancement) {
            setProcessedStream(rawStream);
            return;
        }

        // Setup hidden video and canvas
        const video = document.createElement("video");
        video.srcObject = rawStream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        videoRef.current = video;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvasRef.current = canvas;

        // Native FaceDetector (supported in Chrome/Edge via flags or origin trials)
        // Fallback to center frame if not available
        let faceDetector: any = null;
        if (typeof window !== "undefined" && 'FaceDetector' in window) {
            try {
                // @ts-expect-error
                faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            } catch (e) {
                console.warn("FaceDetector API not fully supported.");
            }
        }

        let lastDetectionTime = 0;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Start processing loop
            const processFrame = async () => {
                if (!ctx || !video) return;

                const width = canvas.width;
                const height = canvas.height;

                // 1. Auto-Framing Algorithm
                if (options.autoFraming && faceDetector && performance.now() - lastDetectionTime > 500) {
                    lastDetectionTime = performance.now();
                    try {
                        const faces = await faceDetector.detect(video);
                        if (faces.length > 0) {
                            const face = faces[0].boundingBox;
                            // Calculate target crop to keep face centered
                            const faceCenterX = face.x + face.width / 2;
                            const faceCenterY = face.y + face.height / 2;
                            
                            // Target a crop size that is roughly 2x the face size, bounded by screen
                            let targetSize = Math.max(face.width, face.height) * 2.5;
                            targetSize = Math.min(targetSize, Math.min(width, height));
                            
                            let targetX = faceCenterX - targetSize / 2;
                            let targetY = faceCenterY - targetSize / 2;

                            // Constrain bounds
                            targetX = Math.max(0, Math.min(targetX, width - targetSize));
                            targetY = Math.max(0, Math.min(targetY, height - targetSize));

                            targetCropRef.current = { x: targetX, y: targetY, size: targetSize };
                        } else {
                            // Reset to full frame if no face
                            targetCropRef.current = { x: 0, y: 0, size: Math.min(width, height) };
                        }
                    } catch (e) {
                        // Ignore detection errors
                    }
                } else if (!options.autoFraming) {
                    targetCropRef.current = { x: 0, y: 0, size: Math.min(width, height) };
                }

                // Smoothly interpolate current crop to target crop (easing)
                const c = currentCropRef.current;
                const t = targetCropRef.current;
                c.x += (t.x - c.x) * 0.1;
                c.y += (t.y - c.y) * 0.1;
                c.size += (t.size - c.size) * 0.1;

                // 2. Low-Light Enhancement Algorithm
                if (options.lowLightEnhancement) {
                    // Simple heuristic: bump brightness and contrast slightly if enabled
                    ctx.filter = 'brightness(1.2) contrast(1.1)';
                } else {
                    ctx.filter = 'none';
                }

                // 3. Draw the frame (with crop if auto-framing)
                if (options.autoFraming) {
                    ctx.drawImage(
                        video, 
                        c.x, c.y, c.size, c.size, // Source crop
                        0, 0, width, height       // Destination (stretch to full canvas)
                    );
                } else {
                    ctx.drawImage(video, 0, 0, width, height);
                }

                animationFrameRef.current = requestAnimationFrame(processFrame);
            };

            processFrame();

            // Extract the processed stream
            // @ts-expect-error - captureStream exists on canvas
            const outStream = canvas.captureStream(30) as MediaStream;
            
            // Add original audio tracks back
            rawStream.getAudioTracks().forEach(track => {
                outStream.addTrack(track);
            });

            setProcessedStream(outStream);
        };

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            video.pause();
            video.srcObject = null;
        };
    }, [rawStream, options.autoFraming, options.lowLightEnhancement]);

    return processedStream;
};
