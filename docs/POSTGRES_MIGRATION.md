# Migrating Washday from SQLite to PostgreSQL

## 1. Create a PostgreSQL database
Any provider works (Neon, Vercel Postgres, Supabase, Railway, local Postgres).
Copy two connection strings:

- `DATABASE_URL` – pooled URL (used by the running app)
- `DIRECT_URL` – direct URL (used by Prisma Migrate). If you have only one URL, use it for both.

Put them in `.env` (replace the old `DATABASE_URL="file:./dev.db"` line). See `.env.example`.

## 2. Install and create the tables
```bash
pnpm install
pnpm db:deploy        # applies prisma/migrations/20261110000000_init to PostgreSQL
```

## 3. Copy the existing SQLite data (optional, one time)
Keep your old `prisma/dev.db` file, then:
```bash
node --env-file=.env scripts/migrate-sqlite-to-postgres.js --sqlite prisma/dev.db --dry-run   # validate only
node --env-file=.env scripts/migrate-sqlite-to-postgres.js --sqlite prisma/dev.db             # real import
```
- Needs Node 22.13+ (built-in `node:sqlite`). On older Node: `npm install --no-save better-sqlite3`.
- The SQLite file is opened read-only and never changed.
- The import is one transaction (all or nothing), refuses a non-empty target unless `--allow-nonempty`, and checks row counts afterwards.
- Expired sessions are skipped (users simply sign in again). Add `--keep-expired-sessions` to copy them.
- Passwords are bcrypt hashes and are copied unchanged, so existing logins keep working.

Starting fresh instead? Skip step 3 and run `pnpm db:seed` for the demo accounts.

## 4. Run
```bash
pnpm dev
```

## 5. Deploy to Vercel
1. Push the project to GitHub and import it in Vercel.
2. Add environment variables `DATABASE_URL` and `DIRECT_URL` (Production and Preview).
3. Deploy. Vercel runs the `vercel-build` script: `prisma generate && prisma migrate deploy && next build`.

## Changing the schema later
```bash
pnpm db:migrate       # create and apply a new migration locally
```
Commit the new folder in `prisma/migrations/`; Vercel applies it on the next deploy.

## Already used `prisma db push` on the Postgres database?
Mark the first migration as applied instead of re-running it:
```bash
pnpm prisma migrate resolve --applied 20261110000000_init
```
