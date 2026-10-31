import { NextResponse } from "next/server";
import { DisputeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to update an investigation." }, { status: 401 });
    if (user.role !== "STAFF") return NextResponse.json({ error: "Laundry staff access is required." }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const allowed: DisputeStatus[] = ["OPEN", "INVESTIGATING", "RESOLVED"];
    if (!allowed.includes(body.status)) return NextResponse.json({ error: "Choose a valid investigation status." }, { status: 400 });
    const result = await prisma.dispute.update({ where: { id }, data: {
      status: body.status,
      resolution: String(body.resolution ?? "").trim().slice(0, 500),
    } });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not update this report." }, { status: 404 });
  }
}
