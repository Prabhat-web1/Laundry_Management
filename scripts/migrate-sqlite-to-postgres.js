#!/usr/bin/env node
/*
 * One-off data import: copies an existing Washday SQLite database into PostgreSQL.
 *
 *   node --env-file=.env scripts/migrate-sqlite-to-postgres.js --sqlite prisma/dev.db
 *
 * Options
 *   --sqlite <path>        SQLite file to read (default: prisma/dev.db)
 *   --dry-run              Read and validate the SQLite data only; do not touch PostgreSQL
 *   --allow-nonempty       Import even if the PostgreSQL tables already contain rows
 *                          (rows whose id already exists are skipped, never overwritten)
 *   --keep-expired-sessions  Also copy sessions that have already expired (default: skipped)
 *
 * The PostgreSQL schema must already exist (run `pnpm db:deploy` first).
 * The SQLite file is opened read-only and is never modified.
 * Needs Node 22.13+ (built-in node:sqlite) or the optional better-sqlite3 package.
 */
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const sqlitePath = path.resolve(option("--sqlite", "prisma/dev.db"));
const dryRun = flag("--dry-run");
const allowNonEmpty = flag("--allow-nonempty");
const keepExpired = flag("--keep-expired-sessions");

function openSqlite(file) {
  if (!fs.existsSync(file)) throw new Error(`SQLite file not found: ${file}`);
  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(file, { readOnly: true });
    return { all: (sql) => db.prepare(sql).all(), close: () => db.close() };
  } catch (error) {
    if (error && error.code !== "ERR_UNKNOWN_BUILTIN_MODULE" && error.code !== "MODULE_NOT_FOUND") throw error;
  }
  try {
    const Database = require("better-sqlite3");
    const db = new Database(file, { readonly: true, fileMustExist: true });
    return { all: (sql) => db.prepare(sql).all(), close: () => db.close() };
  } catch {
    throw new Error(
      "No SQLite reader available. Use Node 22.13 or newer (built-in node:sqlite), " +
      "or run `npm install --no-save better-sqlite3` and try again."
    );
  }
}

// Prisma stores SQLite DateTime values as epoch milliseconds (INTEGER). Older or
// hand-edited files may hold ISO text, so both are accepted.
function toDate(value, label) {
  let date;
  if (typeof value === "number" || typeof value === "bigint") date = new Date(Number(value));
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) date = new Date(Number(value));
  else if (typeof value === "string") date = new Date(value.includes("T") || value.includes("Z") ? value : value.replace(" ", "T") + "Z");
  else date = new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date in ${label}: ${String(value)}`);
  return date;
}

const text = (value) => (value === null || value === undefined ? "" : String(value));
const nullable = (value) => (value === null || value === undefined ? null : String(value));

function readSqlite() {
  const db = openSqlite(sqlitePath);
  try {
    const users = db.all('SELECT * FROM "User"').map((r) => ({
      id: text(r.id), name: text(r.name), email: text(r.email), passwordHash: text(r.passwordHash),
      role: text(r.role), studentId: nullable(r.studentId), room: text(r.room), hostel: text(r.hostel), phone: text(r.phone),
    }));
    const sessions = db.all('SELECT * FROM "Session"').map((r) => ({
      id: text(r.id), tokenHash: text(r.tokenHash), userId: text(r.userId),
      expiresAt: toDate(r.expiresAt, `Session ${r.id}.expiresAt`), createdAt: toDate(r.createdAt, `Session ${r.id}.createdAt`),
    }));
    const requests = db.all('SELECT * FROM "LaundryRequest"').map((r) => ({
      id: text(r.id), studentName: text(r.studentName), studentId: text(r.studentId), userId: text(r.userId),
      room: text(r.room), hostel: text(r.hostel), phone: text(r.phone), items: text(r.items),
      pickupAt: toDate(r.pickupAt, `LaundryRequest ${r.id}.pickupAt`),
      dropOffAt: toDate(r.dropOffAt, `LaundryRequest ${r.id}.dropOffAt`),
      expectedAt: toDate(r.expectedAt, `LaundryRequest ${r.id}.expectedAt`),
      notes: text(r.notes), status: text(r.status), batchTag: text(r.batchTag),
      createdAt: toDate(r.createdAt, `LaundryRequest ${r.id}.createdAt`),
      updatedAt: toDate(r.updatedAt, `LaundryRequest ${r.id}.updatedAt`),
    }));
    const disputes = db.all('SELECT * FROM "Dispute"').map((r) => ({
      id: text(r.id), requestId: text(r.requestId), itemName: text(r.itemName), issueType: text(r.issueType),
      description: text(r.description), status: text(r.status), resolution: text(r.resolution),
      createdAt: toDate(r.createdAt, `Dispute ${r.id}.createdAt`), updatedAt: toDate(r.updatedAt, `Dispute ${r.id}.updatedAt`),
    }));
    return { users, sessions, requests, disputes };
  } finally {
    db.close();
  }
}

function validate({ users, sessions, requests, disputes }) {
  const problems = [];
  const userIds = new Set(users.map((u) => u.id));
  const requestIds = new Set(requests.map((r) => r.id));
  const roles = new Set(["STUDENT", "STAFF"]);
  const stages = new Set(["REQUESTED", "COLLECTED", "WASHING", "DRYING", "READY", "DELIVERED"]);
  const disputeStates = new Set(["OPEN", "INVESTIGATING", "RESOLVED"]);
  users.forEach((u) => { if (!roles.has(u.role)) problems.push(`User ${u.email}: unknown role "${u.role}"`); });
  sessions.forEach((s) => { if (!userIds.has(s.userId)) problems.push(`Session ${s.id}: missing user ${s.userId}`); });
  requests.forEach((r) => {
    if (!userIds.has(r.userId)) problems.push(`LaundryRequest ${r.batchTag}: missing user ${r.userId}`);
    if (!stages.has(r.status)) problems.push(`LaundryRequest ${r.batchTag}: unknown status "${r.status}"`);
    try { JSON.parse(r.items); } catch { problems.push(`LaundryRequest ${r.batchTag}: items is not valid JSON`); }
  });
  disputes.forEach((d) => {
    if (!requestIds.has(d.requestId)) problems.push(`Dispute ${d.id}: missing request ${d.requestId}`);
    if (!disputeStates.has(d.status)) problems.push(`Dispute ${d.id}: unknown status "${d.status}"`);
  });
  return problems;
}

async function main() {
  console.log(`Reading SQLite database: ${sqlitePath}`);
  const data = readSqlite();
  if (!keepExpired) {
    const now = Date.now();
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((s) => s.expiresAt.getTime() > now);
    if (before !== data.sessions.length) console.log(`Skipping ${before - data.sessions.length} expired session(s).`);
  }
  const counts = { User: data.users.length, Session: data.sessions.length, LaundryRequest: data.requests.length, Dispute: data.disputes.length };
  console.log("Rows to import:", counts);

  const problems = validate(data);
  if (problems.length) {
    console.error("\nData problems found; nothing was imported:");
    problems.forEach((p) => console.error(` - ${p}`));
    process.exit(1);
  }
  if (dryRun) {
    console.log("\nDry run complete: the SQLite data is valid. PostgreSQL was not contacted.");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Run with `node --env-file=.env ...` or export it first.");

  const { PrismaClient } = require("@prisma/client");
  // Prefer the direct connection for a bulk import when one is configured.
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
  try {
    const existing = {
      User: await prisma.user.count(), Session: await prisma.session.count(),
      LaundryRequest: await prisma.laundryRequest.count(), Dispute: await prisma.dispute.count(),
    };
    if (Object.values(existing).some(Boolean) && !allowNonEmpty) {
      console.error("\nThe PostgreSQL database already contains data:", existing);
      console.error("Import cancelled. Use an empty database, or re-run with --allow-nonempty to add only missing rows.");
      process.exit(1);
    }

    // All-or-nothing: either every table is imported or none is.
    await prisma.$transaction(async (tx) => {
      await tx.user.createMany({ data: data.users, skipDuplicates: true });
      await tx.session.createMany({ data: data.sessions, skipDuplicates: true });
      await tx.laundryRequest.createMany({ data: data.requests, skipDuplicates: true });
      await tx.dispute.createMany({ data: data.disputes, skipDuplicates: true });
    }, { timeout: 60_000 });

    const after = {
      User: await prisma.user.count(), Session: await prisma.session.count(),
      LaundryRequest: await prisma.laundryRequest.count(), Dispute: await prisma.dispute.count(),
    };
    console.log("\nPostgreSQL row counts after import:", after);
    const short = Object.keys(counts).filter((table) => after[table] < counts[table]);
    if (short.length) throw new Error(`Row count check failed for: ${short.join(", ")}`);
    console.log("Import finished and row counts match.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\nMigration failed: ${error.message}`);
  process.exit(1);
});
