import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { disputeSchema } from "@/lib/validation";
export async function POST(request) {
    try {
        const user = await getCurrentUser();
        if (!user)
            return NextResponse.json({ error: "Sign in to report a laundry issue." }, { status: 401 });
        if (user.role !== "STUDENT")
            return NextResponse.json({ error: "Only student accounts can open a report." }, { status: 403 });
        const body = await request.json();
        const parsed = disputeSchema.safeParse(body);
        if (!parsed.success)
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Review the report details." }, { status: 400 });
        const ownedRequest = await prisma.laundryRequest.findFirst({ where: { id: parsed.data.requestId, userId: user.id } });
        if (!ownedRequest)
            return NextResponse.json({ error: "That request could not be found in your laundry history." }, { status: 404 });
        const result = await prisma.dispute.create({ data: {
                ...parsed.data,
            } });
        return NextResponse.json(result, { status: 201 });
    }
    catch {
        return NextResponse.json({ error: "Could not submit the report. Try again." }, { status: 500 });
    }
}
