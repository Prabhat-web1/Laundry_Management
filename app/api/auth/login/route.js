
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(request) {
  const body = await request.json().catch(() => null);

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter your login details." },
      { status: 400 }
    );
  }

  const requestedRole = body?.role;

  if (!["STUDENT", "STAFF"].includes(requestedRole)) {
    return NextResponse.json(
      { error: "Please select Student or Staff login." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user) {
  return NextResponse.json(
    { error: "No account found with this email." },
    { status: 401 }
  );
}

if (user.role !== requestedRole) {
  return NextResponse.json(
    { error: `This account is not registered as ${requestedRole}.` },
    { status: 403 }
  );
}

const passwordMatches = await bcrypt.compare(
  parsed.data.password,
  user.passwordHash
);

if (!passwordMatches) {
  return NextResponse.json(
    { error: "Incorrect password." },
    { status: 401 }
  );
}

  const { token, tokenHash } = createSessionToken();

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;

  const response = NextResponse.json({
    ok: true,
    user: safeUser,
  });

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}
