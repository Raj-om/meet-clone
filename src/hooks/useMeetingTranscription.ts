
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useMeetingTranscription() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [currentUtterance, setCurrentUtterance] = useState("");
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("SpeechRecognition API not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + " ";
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setTranscript((prev) => prev + finalTranscript);
                setCurrentUtterance("");
            }
            if (interimTranscript) {
                setCurrentUtterance(interimTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === "not-allowed") {
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            // Auto-restart if we are supposed to be listening
            if (isListening) {
                try {
                    recognition.start();
                } catch (e) {
                    // Ignore already started errors
                }
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
    }, [isListening]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Failed to start listening:", e);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    const clearTranscript = useCallback(() => {
        setTranscript("");
        setCurrentUtterance("");
    }, []);

    return {
        isListening,
        startListening,
        stopListening,
        transcript,
        currentUtterance,
        clearTranscript
    };
}
