/*
 * Demo-data seed (JavaScript port of the original prisma/seed.ts, corrected for the current schema:
 * Dispute now requires itemName/issueType). Idempotent: users are upserted, the sample request is
 * created only when the student has none. Run with:  pnpm db:seed
 */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("washday123", 10);

  const student = await prisma.user.upsert({
    where: { email: "student@washday.demo" },
    update: { passwordHash, name: "Aarav Mehta", role: "STUDENT", studentId: "STU-1024", room: "B-204", hostel: "Maple House", phone: "+91 98765 43210" },
    create: { email: "student@washday.demo", passwordHash, name: "Aarav Mehta", role: "STUDENT", studentId: "STU-1024", room: "B-204", hostel: "Maple House", phone: "+91 98765 43210" },
  });

  await prisma.user.upsert({
    where: { email: "rohan@washday.demo" },
    update: { passwordHash, name: "Rohan Kapoor", role: "STUDENT", studentId: "STU-1088", room: "C-118", hostel: "Cedar House", phone: "+91 98765 43211" },
    create: { email: "rohan@washday.demo", passwordHash, name: "Rohan Kapoor", role: "STUDENT", studentId: "STU-1088", room: "C-118", hostel: "Cedar House", phone: "+91 98765 43211" },
  });

  await prisma.user.upsert({
    where: { email: "staff@washday.demo" },
    update: { passwordHash, name: "Laundry Operations", role: "STAFF" },
    create: { email: "staff@washday.demo", passwordHash, name: "Laundry Operations", role: "STAFF" },
  });

  const requestCount = await prisma.laundryRequest.count({ where: { userId: student.id } });
  if (requestCount === 0) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const request = await prisma.laundryRequest.create({
      data: {
        studentName: student.name, studentId: student.studentId, userId: student.id,
        room: student.room, hostel: student.hostel, phone: student.phone,
        items: JSON.stringify([{ name: "T-shirts", quantity: 4 }, { name: "Jeans", quantity: 2 }, { name: "Bedsheet", quantity: 1 }]),
        pickupAt: new Date(now - day), dropOffAt: new Date(now + day), expectedAt: new Date(now + 2 * day),
        notes: "Please keep the bedsheet separate.", batchTag: "MA-2601", status: "WASHING",
      },
    });
    await prisma.dispute.create({
      data: { requestId: request.id, itemName: "Socks", issueType: "Missing item", description: "One sock was missing from the previous batch.", status: "INVESTIGATING", resolution: "" },
    });
  }
  console.log("Seed complete: demo accounts ready (password for all three: washday123).");
}

main()
  .catch((error) => { console.error("Seed failed:", String(error.message).split("\n").filter(Boolean).slice(-2).join(" | ")); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
