import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        status: "healthy",
        service: "CLARIVOX Meet Clone",
        timestamp: new Date().toISOString(),
    });
}
