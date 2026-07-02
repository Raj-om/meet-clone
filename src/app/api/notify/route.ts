import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
    try {
        const { email, meetingId, type } = await req.json();

        if (!email || !meetingId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Creating ethereal test account for local development
        const testAccount = await nodemailer.createTestAccount();

        const transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });

        const host = req.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "http"; // Assuming HTTP for local network testing
        const inviteLink = `${protocol}://${host}/meet/${meetingId}`;

        // Send email
        const info = await transporter.sendMail({
            from: '"Meet Clone Notifications" <noreply@meetclone.local>',
            to: email,
            subject: type === "schedule" ? "You have a scheduled meeting!" : "Join the Meeting",
            text: `Please join the meeting using this link: ${inviteLink}`,
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>You have been invited to a Meet Clone meeting</h2>
          <p>Click the link below to join:</p>
          <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #1a73e8; color: white; text-decoration: none; border-radius: 5px;">Join Meeting</a>
          <p style="margin-top: 20px; color: #5f6368; font-size: 12px;">Meeting ID: ${meetingId}</p>
        </div>
      `,
        });

        return NextResponse.json({
            success: true,
            message: "Notification sent successfully",
            testUrl: nodemailer.getTestMessageUrl(info) // Useful for dev testing
        });
    } catch (error) {
        console.error("Error sending notification:", error);
        return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
    }
}
