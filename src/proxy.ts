import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"

export async function proxy(request: NextRequest) {
    const session = await auth()

    const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')

    if (isAuthPage) {
        if (session) {
            return NextResponse.redirect(new URL('/', request.url))
        }
        return NextResponse.next()
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/login', '/register'],
}
