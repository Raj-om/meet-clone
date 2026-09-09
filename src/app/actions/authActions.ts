"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export async function loginAction(prevState: any, formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
        return { error: "Missing fields" }
    }

    try {
        await signIn("credentials", {
            email,
            password,
            redirectTo: "/",
        })
    } catch (error: any) {
        if (error instanceof AuthError) {
            if (error.type === "CredentialsSignin") {
                return { error: "Invalid email or password." }
            }
            return { error: "Authentication failed." }
        }
        if (error?.message?.includes("NEXT_REDIRECT") || error?.digest?.startsWith("NEXT_REDIRECT")) {
            throw error // Allow Next.js redirect
        }
        console.error("[loginAction error]:", error)
        return { error: error?.message || "Invalid email or password." }
    }

    return { success: true }
}

export async function registerAction(prevState: any, formData: FormData) {
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password || !name) {
        return { error: "Missing required fields" }
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return { error: "Email already in use" }
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        })

        await signIn("credentials", {
            email,
            password,
            redirectTo: "/",
        })
    } catch (error: any) {
        if (error instanceof AuthError) {
            return { error: "Authentication failed after registration." }
        }
        if (error?.message?.includes("NEXT_REDIRECT") || error?.digest?.startsWith("NEXT_REDIRECT")) {
            throw error // Allow Next.js redirect
        }
        console.error("[registerAction error]:", error)
        return { error: error?.message || "Registration failed. Please check your details and try again." }
    }

    return { success: true }
}
