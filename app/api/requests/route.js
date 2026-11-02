import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requestSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET(request) {
    try {
        const user = await getCurrentUser();
        if (!user)
            return NextResponse.json({ error: "Sign in to see laundry requests." }, { status: 401 });
        const requests = await prisma.laundryRequest.findMany({
            where: user.role === "STAFF" ? undefined : { userId: user.id },
            include: { disputes: { orderBy: { createdAt: "desc" } } },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(requests);
    }
    catch {
        return NextResponse.json({ error: "Could not load laundry requests." }, { status: 500 });
    }
}
export async function POST(request) {
    try {
        const user = await getCurrentUser();
        if (!user)
            return NextResponse.json({ error: "Sign in to create a laundry request." }, { status: 401 });
        if (user.role !== "STUDENT")
            return NextResponse.json({ error: "Only student accounts can create laundry requests." }, { status: 403 });
        if (!user.studentId || !user.room || !user.hostel || !user.phone)
            return NextResponse.json({ error: "Your laundry profile is incomplete. Ask the laundry desk to update it." }, { status: 400 });
        const body = await request.json();
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success)
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Review the request details." }, { status: 400 });
        const now = new Date();
        const hostelCode = String(user.hostel ?? "WL").replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "WL";
        const count = await prisma.laundryRequest.count();
        const result = await prisma.laundryRequest.create({ data: {
                studentName: user.name, studentId: user.studentId, userId: user.id,
                room: user.room, hostel: user.hostel, phone: user.phone,
                items: JSON.stringify(parsed.data.items),
                pickupAt: new Date(parsed.data.pickupAt), dropOffAt: new Date(parsed.data.dropOffAt), expectedAt: new Date(parsed.data.expectedAt), notes: parsed.data.notes ?? "",
                batchTag: `${hostelCode}-${String(now.getFullYear()).slice(-2)}${String(count + 1).padStart(2, "0")}`,
            }, include: { disputes: true } });
        return NextResponse.json(result, { status: 201 });
    }
    catch {
        return NextResponse.json({ error: "Could not create the laundry request. Try again." }, { status: 500 });
    }
}
