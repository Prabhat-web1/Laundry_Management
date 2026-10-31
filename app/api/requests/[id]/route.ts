import { NextResponse } from "next/server";
import { LaundryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const stages: LaundryStatus[] = ["REQUESTED", "COLLECTED", "WASHING", "DRYING", "READY", "DELIVERED"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to update processing." }, { status: 401 });
    if (user.role !== "STAFF") return NextResponse.json({ error: "Laundry staff access is required." }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    if (body.status && !stages.includes(body.status)) return NextResponse.json({ error: "Unknown processing stage." }, { status: 400 });
    if (body.status) {
      const current = await prisma.laundryRequest.findUnique({ where: { id }, select: { status: true } });
      if (!current) return NextResponse.json({ error: "This laundry batch could not be found." }, { status: 404 });
      if (stages.indexOf(body.status) !== stages.indexOf(current.status) + 1) {
        return NextResponse.json({ error: "Move the batch forward one processing stage at a time." }, { status: 409 });
      }
    }
    const result = await prisma.laundryRequest.update({
      where: { id }, data: body.status ? { status: body.status } : { notes: String(body.notes ?? "").slice(0, 500) },
      include: { disputes: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not update this laundry request." }, { status: 404 });
  }
}
