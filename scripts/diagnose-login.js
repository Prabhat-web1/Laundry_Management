#!/usr/bin/env node
/*
 * READ-ONLY login diagnostic. Changes nothing in the database and never prints
 * passwords, hashes or connection strings.
 *
 *    *   node --env-file=.env scripts/diagnose-login.js
 *   node --env-file=.env scripts/diagnose-login.js <email> <password>
 *
 * Optional args: <email> <password> -> also tests bcrypt.compare for that user.
 */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const [emailArg, passwordArg] = process.argv.slice(2);
const DEMO = ["student@washday.demo", "rohan@washday.demo", "staff@washday.demo"];

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[OK] Connected to PostgreSQL through DATABASE_URL.");

    const users = await prisma.user.findMany({ select: { email: true, role: true, passwordHash: true } });
    console.log(`[INFO] User rows in database: ${users.length}`);
    if (users.length === 0) {
      console.log("[CAUSE] The User table is EMPTY. Every login returns 'not recognized'. Run: pnpm db:seed (see prisma/seed.js).");
      return;
    }
    for (const u of users) {
      const fmt = /^\$2[aby]\$\d{2}\$.{53}$/.test(u.passwordHash) ? "valid bcrypt" : "NOT a valid bcrypt hash";
      const caseNote = u.email !== u.email.toLowerCase() ? "  <-- UPPERCASE letters: login lowercases input, so this email can never match" : "";
      console.log(`  - ${u.email} [${u.role}] hash: ${fmt}${caseNote}`);
    }
    const emails = new Set(users.map((u) => u.email));
    const missing = DEMO.filter((e) => !emails.has(e));
    if (missing.length) console.log("[WARN] Demo accounts not present:", missing.join(", "));

    if (emailArg && passwordArg) {
      const user = await prisma.user.findUnique({ where: { email: emailArg.toLowerCase() } });
      if (!user) console.log(`[RESULT] No user with email "${emailArg.toLowerCase()}" -> login returns 401.`);
      else console.log(`[RESULT] bcrypt.compare for ${user.email}: ${(await bcrypt.compare(passwordArg, user.passwordHash)) ? "MATCH (login would succeed)" : "NO MATCH (login returns 401)"}`);
    }
  } catch (error) {
    console.error("[FAIL] Could not complete the check:", error.code || "", String(error.message).split("\n").filter(Boolean).slice(-2).join(" | "));
    console.error("       If this is a connection error, run scripts/diagnose-network.js.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main();
