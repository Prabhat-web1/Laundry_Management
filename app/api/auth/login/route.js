import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
export async function POST(request) {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success)
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter your login details." }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        return NextResponse.json({ error: "That email and password combination was not recognized." }, { status: 401 });
    }
    const { token, tokenHash } = createSessionToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt } });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    const response = NextResponse.json({ ok: true, user: safeUser });
    response.cookies.set(sessionCookieName, token, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
    });
    return response;
}
