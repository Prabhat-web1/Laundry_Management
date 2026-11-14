

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const emailTaken =
  "An account with this email already exists. Please sign in instead.";

const studentIdTaken =
  "That student ID is already registered. Please sign in or contact the laundry desk.";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Review your registration details.",
      },
      { status: 400 }
    );
  }

  const { name, email, studentId, hostel, room, phone, password } =
    parsed.data;

  try {
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: emailTaken }, { status: 409 });
    }

    if (
      await prisma.user.findUnique({
        where: { studentId },
        select: { id: true },
      })
    ) {
      return NextResponse.json({ error: studentIdTaken }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Self-registration can only create STUDENT accounts.
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "STUDENT",
        studentId,
        hostel,
        room,
        phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      const target = [].concat(error.meta?.target ?? []).join(",");
      return NextResponse.json(
        { error: target.includes("studentId") ? studentIdTaken : emailTaken },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:
          "We couldn’t reach the database to create your account. Check your connection and try again.",
      },
      { status: 503 }
    );
  }
}