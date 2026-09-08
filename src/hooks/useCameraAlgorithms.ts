"use client"

export interface CameraAlgorithmsOptions {
    autoFraming?: boolean;
    lowLightEnhancement?: boolean;
}

/**
 * useCameraAlgorithms
 * 
 * Clean, lightweight camera passthrough ensuring 100% native hardware 
 * frame rate and zero latency for AI deepfake detection.
 */
export const useCameraAlgorithms = (
    rawStream: MediaStream | null,
    _options?: CameraAlgorithmsOptions
) => {
    return rawStream;
};

