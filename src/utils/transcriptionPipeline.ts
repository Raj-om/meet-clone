export interface GlobalCaption {
    speakerId: string;
    speakerName: string;
    text: string;
    timestamp: number; // Unix timestamp in ms
}

/**
 * Formats a duration in milliseconds into a WebVTT timestamp: HH:MM:SS.mmm
 */
function formatVttTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Generates a perfectly synced WebVTT subtitle file from a list of global captions
 * and the exact timestamp when the recording started.
 */
export function generateVTT(captions: GlobalCaption[], recordingStartTime: number): string {
    if (captions.length === 0) return "WEBVTT\n\n";

    let vtt = "WEBVTT\n\n";
    
    // Sort captions chronologically
    const sorted = [...captions].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length; i++) {
        const cap = sorted[i];
        
        // If the caption happened before recording started, skip it
        if (cap.timestamp < recordingStartTime) continue;

        const startMs = cap.timestamp - recordingStartTime;
        
        // Estimate the end time. Either 4 seconds later, or right before the next caption
        const defaultDurationMs = 4000; 
        let endMs = startMs + defaultDurationMs;
        
        if (i < sorted.length - 1) {
            const nextCap = sorted[i + 1];
            const nextStartMs = nextCap.timestamp - recordingStartTime;
            if (nextStartMs < endMs) {
                endMs = nextStartMs - 1; // Prevent overlapping subtitle timings
            }
        }

        vtt += `${formatVttTime(startMs)} --> ${formatVttTime(endMs)}\n`;
        vtt += `<v ${cap.speakerName}>${cap.text}\n\n`;
    }

    return vtt;
}

/**
 * Generates an intelligent, human-readable Markdown meeting transcript.
 * It clusters consecutive messages from the same speaker.
 */
export function generateMarkdownNotes(captions: GlobalCaption[], meetingId: string): string {
    if (captions.length === 0) return "# Meeting Transcript\n\nNo audio was transcribed during this meeting.";

    let md = `# Meeting Transcript - ${meetingId}\n`;
    md += `*Generated automatically by CLARIVOX AI*\n\n---\n\n`;

    const sorted = [...captions].sort((a, b) => a.timestamp - b.timestamp);
    
    // Extract Action Items
    const actionItems: {speaker: string, text: string}[] = [];
    const actionKeywords = ["i will", "we need to", "make sure to", "to-do", "todo", "action item", "follow up", "will do", "assign to"];
    
    for (const cap of sorted) {
        const textLower = cap.text.toLowerCase();
        if (actionKeywords.some(kw => textLower.includes(kw)) && cap.text.length > 10) {
            actionItems.push({ speaker: cap.speakerName, text: cap.text.trim() });
        }
    }

    if (actionItems.length > 0) {
        md += `## 📋 Extracted Action Items\n`;
        actionItems.forEach(item => {
            md += `- [ ] **${item.speaker}**: ${item.text}\n`;
        });
        md += `\n---\n\n`;
    }

    md += `## 💬 Full Transcript\n\n`;

    let currentSpeaker = "";
    
    for (const cap of sorted) {
        const date = new Date(cap.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (cap.speakerName !== currentSpeaker) {
            if (currentSpeaker !== "") md += `\n\n`;
            md += `**${cap.speakerName}** \`<${timeString}>\`\n`;
            currentSpeaker = cap.speakerName;
        } else {
            md += ` `; // Append to same paragraph if it's the same speaker
        }

        md += cap.text.trim();
    }

    return md;
}
