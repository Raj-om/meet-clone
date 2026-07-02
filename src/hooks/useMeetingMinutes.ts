
"use client";

import { useState } from "react";

export function useMeetingMinutes() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [minutes, setMinutes] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generateMinutes = async (transcript: string) => {
        if (!transcript.trim()) {
            setError("No transcript available to summarize.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setMinutes(""); // Clear old

        try {
            const prompt = "You are an executive AI assistant. Below is the raw transcript from a video meeting. Please generate highly professional Meeting Minutes. Include exactly three sections: 1) Executive Summary, 2) Key Decisions, and 3) Action Items. Format your response strictly in Markdown.\n\nTranscript:\n" + transcript;
            
            const response = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "deepseek-r1:8b",
                    prompt: prompt,
                    stream: true
                })
            });

            if (!response.ok || !response.body) {
                throw new Error("Failed to connect to local Ollama server.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            let fullResponse = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n").filter(l => l.trim() !== "");
                
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            // DeepSeek-R1 outputs <think> tags. We should strip them for the final UI if we want it clean.
                            fullResponse += parsed.response;
                            
                            // Let's hide the thinking block from the user in real-time
                            if (fullResponse.includes("</think>")) {
                                const finalOutput = fullResponse.split("</think>")[1].trimStart();
                                setMinutes(finalOutput);
                            } else if (!fullResponse.includes("<think>")) {
                                setMinutes(fullResponse);
                            } else {
                                // still thinking...
                                setMinutes("🧠 AI is analyzing the transcript and thinking...\n\n");
                            }
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred during summarization.");
        } finally {
            setIsGenerating(false);
        }
    };

    const clearMinutes = () => {
        setMinutes(null);
        setError(null);
    };

    return {
        isGenerating,
        minutes,
        error,
        generateMinutes,
        clearMinutes
    };
}
