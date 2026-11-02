# Washday — Hostel laundry, without the guesswork

Washday is a full-stack CA project for hostel laundry. Students create itemized collection requests, follow each tagged batch through processing, and report missing or damaged items. Laundry staff manage the queue and keep investigation updates attached to each report.

## Run locally

Requirements: Node.js 20.9 or newer and pnpm.

To launch it by double-clicking in Finder on macOS, open `start.command`. It runs `start.sh` in Terminal. From a terminal, you can also run `./start.sh` directly.

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

The seed creates a student, a second student for the operations queue, and a staff account. Each uses `washday123`.

| Role | Email |
| --- | --- |
| Student | `student@washday.demo` |
| Student (another hostel) | `rohan@washday.demo` |
| Laundry staff | `staff@washday.demo` |

These accounts and credentials are for local demonstration only. Replace them with individually managed accounts before a public deployment.

## Product scope

- **Student laundry service:** create a request with item names, quantities, care notes, collection and laundry drop-off times, room, hostel, and an expected completion time.
- **Laundry operations:** every request receives a batch tag. Staff move it through requested, collected, washing, drying, ready, and delivered; students can inspect its timeline and return estimate.
- **Dispute and resolution service:** students link a missing, damaged, or other issue to a batch. Staff record investigation notes, status, and resolution; students can follow updates.
- **Integrated journey:** request → tag and batch processing → delivery → linked dispute and resolution when needed.

## Implementation

- Next.js App Router with React client components and Route Handlers.
- Prisma ORM and SQLite for users, sessions, laundry requests, items (stored as structured JSON), processing stages, and disputes.
- HTTP-only, same-site session cookies with hashed session tokens; API routes check student or staff roles and students can only access their own laundry records.
- Zod validation is shared between controlled forms and server endpoints.
- TanStack Query manages API-backed state, loading, errors, and cache refresh after mutations.
- Responsive layouts and accessible labels, semantic forms, empty states, and inline validation messages.

## Course alignment

| Course topics | Project evidence |
| --- | --- |
| INT252: reusable components, props, JSX, hooks, controlled forms, validation, API fetching, shared/server state | `components/laundry-dashboard.jsx`, `components/providers.jsx`, `lib/validation.js` |
| INT257: App Router, nested/dynamic route handlers, HTTP methods, ORM/CRUD, environment variables, sessions, role-based authorization, production metadata | `app/api/`, `prisma/schema.prisma`, `lib/auth.js`, `app/layout.jsx` |

## Before presenting or deploying

1. Run `pnpm build` after local setup.
2. Demonstrate both student and staff accounts: submit a collection, advance its batch, create an issue, and record a resolution.
3. Collect real feedback from intended users and note what changed. Do not claim external use or impact without evidence.
4. Configure a persistent production database and private credentials before deployment. The included SQLite file is for local development; serverless hosts need a compatible managed database and production datasource configuration.
5. Record team contributions and prepare to explain an implementation decision and make a small live change for the viva.

## Current limitations

- Demo sign-in uses seeded credentials; there is no account registration, password reset, or institutional identity provider.
- The SQLite datasource is local-development configuration. Production deployment needs a persistent database and deployment-specific environment variables.
- The interface represents collection times and a return location; it does not yet send email/SMS notifications or support online payments.
- Validation and impact evidence must come from real demonstrations and user feedback; sample records are illustrative only.
