import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"

export async function proxy(request: NextRequest) {
    const response = NextResponse.next()

    // 🛡️ LAYER 1: EDGE FIREWALL 🛡️
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    const clientIp = request.ip || 'unknown';
    if (clientIp === '0.0.0.0') { // Simulated malicious IP
        return new NextResponse('Access Denied by Edge Firewall', { status: 403 });
    }

    const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')

    if (isAuthPage) {
        const session = await auth()
        if (session) {
            return NextResponse.redirect(new URL('/', request.url))
        }
        return response
    }

    return response
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
