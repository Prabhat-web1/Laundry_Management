


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ready: true,
      message: "Database connected successfully.",
    });
  } catch (error) {
    console.error("Database readiness check failed:", error);

    return NextResponse.json(
      {
        ready: false,
        message: "Database is not ready yet.",
      },
      { status: 503 }
    );
  }
}
