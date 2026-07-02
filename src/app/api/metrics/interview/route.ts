import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { meetingId, candidateId, candidateName, confidenceScore, eyeContact, voiceStress, speakingTimeMs, flags } = body;

        if (!meetingId || !candidateId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let meeting = await prisma.meeting.findUnique({ where: { roomId: meetingId } });
        if (!meeting) {
            meeting = await prisma.meeting.create({
                data: {
                    roomId: meetingId,
                    title: "Interview Session " + meetingId,
                    hostId: "dummy-host",
                    scheduledAt: new Date(),
                }
            });
        }

        const result = await prisma.interviewResult.create({
            data: {
                meetingId: meeting.id,
                candidateId,
                candidateName,
                confidenceScore,
                eyeContact,
                voiceStress,
                speakingTimeMs,
                flags: JSON.stringify(flags),
            }
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("Interview Metrics Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
