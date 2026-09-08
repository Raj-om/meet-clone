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
    const animationFrameRef = useRef<number | null>(null);
    
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

        // If no algorithms are enabled or supported, return the raw stream directly
        const canAutoFrame = Boolean(options.autoFraming && typeof window !== "undefined" && "FaceDetector" in window);
        if (!canAutoFrame && !options.lowLightEnhancement) {
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

        let faceDetector: any = null;
        if (canAutoFrame) {
            try {
                // @ts-expect-error
                faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            } catch (e) {
                console.warn("FaceDetector API not available.");
            }
        }

        let lastDetectionTime = 0;

        const setupAndStart = () => {
            const width = video.videoWidth || 640;
            const height = video.videoHeight || 480;
            canvas.width = width;
            canvas.height = height;

            const initialSize = Math.min(width, height);
            targetCropRef.current = { x: 0, y: 0, size: initialSize };
            currentCropRef.current = { x: 0, y: 0, size: initialSize };

            // Start processing loop
            const processFrame = async () => {
                if (!ctx || !video) return;

                const curW = canvas.width;
                const curH = canvas.height;

                // 1. Auto-Framing Algorithm (only if FaceDetector is actually present)
                if (faceDetector && performance.now() - lastDetectionTime > 500) {
                    lastDetectionTime = performance.now();
                    try {
                        const faces = await faceDetector.detect(video);
                        if (faces.length > 0) {
                            const face = faces[0].boundingBox;
                            const faceCenterX = face.x + face.width / 2;
                            const faceCenterY = face.y + face.height / 2;
                            
                            let targetSize = Math.max(face.width, face.height) * 2.5;
                            targetSize = Math.min(targetSize, Math.min(curW, curH));
                            
                            let targetX = faceCenterX - targetSize / 2;
                            let targetY = faceCenterY - targetSize / 2;

                            targetX = Math.max(0, Math.min(targetX, curW - targetSize));
                            targetY = Math.max(0, Math.min(targetY, curH - targetSize));

                            targetCropRef.current = { x: targetX, y: targetY, size: targetSize };
                        } else {
                            targetCropRef.current = { x: 0, y: 0, size: Math.min(curW, curH) };
                        }
                    } catch {
                        targetCropRef.current = { x: 0, y: 0, size: Math.min(curW, curH) };
                    }
                }

                // Smoothly interpolate current crop
                const c = currentCropRef.current;
                const t = targetCropRef.current;
                c.x += (t.x - c.x) * 0.1;
                c.y += (t.y - c.y) * 0.1;
                c.size += (t.size - c.size) * 0.1;

                // 2. Low-Light Enhancement Algorithm
                if (options.lowLightEnhancement) {
                    ctx.filter = 'brightness(1.2) contrast(1.1)';
                } else {
                    ctx.filter = 'none';
                }

                // 3. Draw the frame (only crop if faceDetector is active and crop size is valid)
                if (faceDetector && c.size > 50) {
                    ctx.drawImage(
                        video, 
                        c.x, c.y, c.size, c.size,
                        0, 0, curW, curH
                    );
                } else {
                    ctx.drawImage(video, 0, 0, curW, curH);
                }

                animationFrameRef.current = requestAnimationFrame(processFrame);
            };

            processFrame();

            // Extract the processed stream
            const outStream = (canvas as unknown as { captureStream: (fps?: number) => MediaStream }).captureStream(30);
            
            // Add original audio tracks back
            rawStream.getAudioTracks().forEach(track => {
                outStream.addTrack(track);
            });

            setProcessedStream(outStream);
        };

        if (video.readyState >= 1) {
            setupAndStart();
        } else {
            video.onloadedmetadata = setupAndStart;
        }
        video.play().catch(() => {});

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            video.pause();
            video.srcObject = null;
        };
    }, [rawStream, options.autoFraming, options.lowLightEnhancement]);

    return processedStream;
};
