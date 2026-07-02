import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { meetingId, studentId, studentName, score, plagiarismRisk, violations } = body;

        if (!meetingId || !studentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Ensure meeting exists
        let meeting = await prisma.meeting.findUnique({ where: { roomId: meetingId } });
        if (!meeting) {
            // Create a dummy meeting record for these metrics if it doesn't exist
            meeting = await prisma.meeting.create({
                data: {
                    roomId: meetingId,
                    title: "Exam Session " + meetingId,
                    hostId: "dummy-host", // In production, this should be the actual host ID
                    scheduledAt: new Date(),
                }
            });
        }

        const result = await prisma.examResult.create({
            data: {
                meetingId: meeting.id,
                studentId,
                studentName,
                score,
                plagiarismRisk,
                violations: JSON.stringify(violations),
            }
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("Exam Metrics Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
