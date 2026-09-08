import { NextRequest, NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"

export async function GET(req: NextRequest) {
    const room = req.nextUrl.searchParams.get("room")
    const username = req.nextUrl.searchParams.get("username")
    
    if (!room) {
        return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 })
    }
    
    if (!username) {
        return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 })
    }

    const apiKey = process.env.LIVEKIT_API_KEY || "API8gphux6Hh6H8"
    const apiSecret = process.env.LIVEKIT_API_SECRET || "5jfv7ZtFiU5nYSVWandPFyAgutBfhVV8fABhOfheosKC"
    const wsUrl = process.env.LIVEKIT_URL || "wss://meet-clone-h7gsuvxw.livekit.cloud"

    if (!apiKey || !apiSecret || !wsUrl) {
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    try {
        const at = new AccessToken(apiKey, apiSecret, {
            identity: username,
            name: username,
        })
        
        at.addGrant({ roomJoin: true, room: room })

        const token = await at.toJwt()
        return NextResponse.json({ token })
    } catch (error) {
        console.error("LiveKit Token Error:", error)
        return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
    }
}
