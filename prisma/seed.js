const bcrypt = require("bcryptjs");
const { PrismaClient, UserRole } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
    const passwordHash = await bcrypt.hash("washday123", 10);
    const student = await prisma.user.upsert({
        where: { email: "student@washday.demo" },
        update: { passwordHash, name: "Aarav Mehta", role: UserRole.STUDENT, studentId: "STU-1024", room: "B-204", hostel: "Maple House", phone: "+91 98765 43210" },
        create: { email: "student@washday.demo", passwordHash, name: "Aarav Mehta", role: UserRole.STUDENT, studentId: "STU-1024", room: "B-204", hostel: "Maple House", phone: "+91 98765 43210" },
    });
    await prisma.user.upsert({
        where: { email: "rohan@washday.demo" },
        update: { passwordHash, name: "Rohan Kapoor", role: UserRole.STUDENT, studentId: "STU-1088", room: "C-118", hostel: "Cedar House", phone: "+91 98765 43211" },
        create: { email: "rohan@washday.demo", passwordHash, name: "Rohan Kapoor", role: UserRole.STUDENT, studentId: "STU-1088", room: "C-118", hostel: "Cedar House", phone: "+91 98765 43211" },
    });
    const staff = await prisma.user.upsert({
        where: { email: "staff@washday.demo" },
        update: { passwordHash, name: "Laundry Operations", role: UserRole.STAFF },
        create: { email: "staff@washday.demo", passwordHash, name: "Laundry Operations", role: UserRole.STAFF },
    });
    const requestCount = await prisma.laundryRequest.count({ where: { userId: student.id } });
    if (requestCount === 0) {
        const now = new Date();
        const request = await prisma.laundryRequest.create({
            data: {
                studentName: student.name,
                studentId: student.studentId,
                userId: student.id,
                room: student.room,
                hostel: student.hostel,
                phone: student.phone,
                items: JSON.stringify([{ name: "T-shirts", quantity: 4 }, { name: "Jeans", quantity: 2 }, { name: "Bedsheet", quantity: 1 }]),
                pickupAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                dropOffAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                expectedAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
                notes: "Please keep the bedsheet separate.",
                batchTag: "MA-2601",
                status: "WASHING",
            },
        });
        await prisma.dispute.create({
            data: { requestId: request.id, type: "Missing item", description: "One sock was missing from the previous batch.", status: "INVESTIGATING", resolution: "" },
        });
    }
    const staffRequestCount = await prisma.laundryRequest.count({ where: { userId: staff.id } });
    if (staffRequestCount > 0)
        await prisma.laundryRequest.deleteMany({ where: { userId: staff.id } });
}
main().finally(async () => prisma.$disconnect());
