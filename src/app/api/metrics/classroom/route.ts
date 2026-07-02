import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { meetingId, studentId, studentName, averageScore, attendanceTime, joinedAt, disconnectedAt } = body;

        if (!meetingId || !studentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let meeting = await prisma.meeting.findUnique({ where: { roomId: meetingId } });
        if (!meeting) {
            meeting = await prisma.meeting.create({
                data: {
                    roomId: meetingId,
                    title: "Classroom Session " + meetingId,
                    hostId: "dummy-host",
                    scheduledAt: new Date(),
                }
            });
        }

        const result = await prisma.classroomEngagement.create({
            data: {
                meetingId: meeting.id,
                studentId,
                studentName,
                averageScore,
                attendanceTime,
                joinedAt: new Date(joinedAt),
                disconnectedAt: disconnectedAt ? new Date(disconnectedAt) : null,
            }
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("Classroom Metrics Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
