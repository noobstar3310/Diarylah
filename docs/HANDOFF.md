# Diarylah — Project Handoff

> **Read this at the start of every task. Update it at the end of every task.**
> This file is the project's memory across sessions, agents, and models. [docs/PLAN.md](PLAN.md) is
> the intended design; this file is the current reality. When they disagree, reality wins — fix the
> code or amend the plan, but never leave the contradiction unrecorded.

**Last updated:** 2026-08-07

---

## How to use this file

| Section | Rule |
|---|---|
| **Current state** | Rewrite to stay accurate. Describes what *is*, not what changed. |
| **Environment** | Rewrite. What a fresh machine needs to run this. |
| **Decisions** | **Append-only.** Every architectural or product decision, with its reasoning. |
| **Session log** | **Append-only, newest first.** Dated entry per task. Include failures. |
| **Next up** | Rewrite to the current best next step. |
| **Known issues & deferred** | Rewrite. Anything broken, stubbed, or knowingly incomplete. |

Record abandoned approaches too. *"Tried X, failed because Y"* often saves more time than a record of
what worked.

---

## Current state

**Phase:** Phase 0 — Foundation, in progress. Database connection proven; no models yet.

**What exists:**

- A `create-next-app` scaffold: Next.js 16.3.0, React 19.2.8, TypeScript, Tailwind v4, App Router at
  [app/](../app/). Default landing page, untouched.
- **Prisma 7.9.1** installed (`prisma`, `@prisma/client`), configured via
  [prisma.config.ts](../prisma.config.ts), with [prisma/schema.prisma](../prisma/schema.prisma)
  holding the datasource provider only. `npx prisma migrate status` connects successfully.
- [docs/PLAN.md](PLAN.md) — full technical plan: stack, security architecture, data model, P/L and FX
  engine, analytics spec, five-phase build order, open questions.
- [CLAUDE.md](../CLAUDE.md) — agent instructions: product north star, working agreement, security
  rules, git and commit conventions, code conventions.
- [README.md](../README.md) — public-facing project description, honest about pre-implementation
  status.
- This file.

The project is named **Diarylah**. `package.json` carries `"name": "diarylah"`. The working directory
is still `trading-app/` and the GitHub repo is not yet created — both are the user's to rename.

**What does not exist yet:** everything else. No Supabase project, no Prisma, no schema, no auth, no
dependencies beyond the scaffold's, no deployment.

**Git:** one commit on `master` (`997e03a`, the initial scaffold). Note the default branch for PRs is
`main`, which does not yet exist locally.

---

## Environment

**Done:**

- Supabase project **Diarylah** exists — free tier, Asia-Pacific. Data API off, automatic RLS on.
- [.env.example](../.env.example) committed, documenting every variable with inline setup notes.

**Still needed before the first migration:**

- `.env.local` populated from `.env.example`. Note the port split: `DATABASE_URL` uses the
  transaction pooler on **6543** for runtime queries, `DIRECT_URL` uses **5432** for Prisma Migrate,
  which cannot run DDL through a pooler. Percent-encode the password.
- A Google OAuth client, with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`,
  registered in Supabase → Authentication → Providers.
- A Vercel project, for the Phase 0 deployment check.

**Not yet needed:** VAPID keys (Phase 4). Frankfurter needs no API key.

---

## Decisions

*Append-only. Newest at the bottom.*

**2026-08-07 — Supabase Auth + Prisma, not pure `supabase-js`.**
The data model is genuinely relational and the core metric is an aggregate across joins, which is
where Prisma's typed relations pay off. Since Next 16 renders server-side, nothing is lost by giving
up browser-direct queries. Cost: Prisma bypasses RLS, mitigated by the two rules below.

**2026-08-07 — RLS stays enabled on every user-scoped table.**
Even though Prisma bypasses it. Supabase publishes a PostgREST API over every table, reachable with
the browser-visible `anon` key; disabling RLS would expose the whole database publicly. Policies are
written as raw SQL inside Prisma migrations.

**2026-08-07 — Tenancy enforced by a Prisma client extension.**
The unscoped client stays module-private; the only exported accessor is `prismaForUser(userId)`,
which auto-injects the user filter. Makes a tenancy-forgetting query unreachable rather than merely
discouraged.

**2026-08-07 — Multi-user from day one.** Public signup, email + Google at launch, X/Twitter later
(highest-friction provider, and its terms need confirming before it is promised in the UI).

**2026-08-07 — All four asset classes: FX, metals, indices, crypto.**
One formula covers all of them provided `contractSize` lives on the instrument. Index and crypto
specs are broker-dependent, so three escape hatches: seeded catalogue → per-journal override →
manual P/L override on the trade.

**2026-08-07 — Multiple journals per user, base currencies USD/GBP/EUR/MYR.**
Each journal simulates a separate trading account with its own base currency.

**2026-08-07 — FX rates are snapshotted onto the trade at write time, never converted at read time.**
Live conversion would make a trade closed six months ago change value on every page load; the equity
curve would reshape itself daily and the journal would stop being a record of what happened. Each
trade stores `pnlQuote`, `fxRate`, and `pnl`. Provider is Frankfurter (ECB): free, keyless,
historical, covers MYR. ECB publishes weekdays only, so weekend fills carry forward the last rate.

**2026-08-07 — `outcome` (win/loss) is derived from P/L, never entered.**
A manual selector could contradict the arithmetic. Supersedes the original request for a win/loss
input field.

**2026-08-07 — Planned TP/SL stored separately from actual exit price and time.**
Most trades do not cleanly hit either target. Deriving P/L from the *plan* would produce a fantasy
account, and the gap between plan and outcome is itself a strong habit signal.

**2026-08-07 — Commission and swap subtracted after FX conversion**, since brokers charge them in the
account currency rather than the instrument's quote currency.

**2026-08-07 — R-multiple is the primary dashboard metric.**
Risk and P/L are both in the quote currency so they cancel — R needs no FX conversion and is
comparable across every instrument and journal. It also requires a stop loss at entry, which enforces
the exact discipline the app exists to build.

**2026-08-07 — Money is `Decimal`, never `Float`.**
Float error accumulates across summed trades and would silently corrupt the equity curve, in an app
whose entire value rests on the user trusting its numbers.

**2026-08-07 — Scheduler is Supabase `pg_cron` → Edge Function, not Vercel Cron.**
Free with minute-level granularity; Vercel's Hobby tier restricts cron frequency in a way that would
break sub-daily reminders.

**2026-08-07 — PWA and push deferred to Phase 4.**
Reminders need trades to remind the user about. The manifest alone can ship earlier at near-zero
cost. Note the hard constraint: the web has no local notification scheduling, so every reminder must
be server cron → web-push → service worker.

**2026-08-07 — CLAUDE.md owns project instructions; AGENTS.md is left to Next.js.**
`next dev` regenerates a managed block, but `upsertAgentRulesBlock` only replaces text between its
markers and skips CLAUDE.md entirely once AGENTS.md hosts the block. CLAUDE.md imports AGENTS.md via
`@AGENTS.md` so the Next-version warning still loads.

**2026-08-07 — The project is named Diarylah.** "Diary" plus *lah*, the Malaysian discourse particle.
Chosen by the user over the alternatives proposed. The warmth of the particle is a real asset rather
than decoration: this is an app that tells you daily that you broke your own rules, and a stern name
would make the habit loop feel punitive. It reads as a nudge from a friend. Also distinctive enough
to be searchable, with no likely trademark collision. Product name is capitalised *Diarylah*; the
package and repo name are lowercase `diarylah`.

**2026-08-07 — One commit per task, staged with `git add .`.**
User preference, replacing the earlier explicit-staging rule. The tradeoff is accepted rather than
ignored: because staging is unconditional, `.gitignore` becomes the sole barrier between
`.env.local` and a public repository. Compensating controls recorded in CLAUDE.md §6 — any change
introducing a secret-bearing file must add its ignore pattern in the same change, and the agent must
read `git status --short` before suggesting any commit. `!.env.example` was added to `.gitignore` so
the template is committable while real env files stay excluded.

**2026-08-07 — Supabase Data API (PostgREST) disabled at project creation.**
Available to us precisely because Prisma queries over a direct Postgres connection. Deletes the
public REST attack surface rather than guarding it with RLS. Auth (`/auth/v1`) and Storage
(`/storage/v1`) are separate services and unaffected — `supabase-js` remains in use for those two
things only. **RLS is still required** as defense in depth, since the Data API could be re-enabled
later. "Automatically expose new tables" also unchecked so a future re-enable would not immediately
publish everything. Automatic-RLS event trigger left ON: Prisma Migrate creates tables with RLS off,
and this trigger closes that gap without relying on anyone remembering.

Tradeoff accepted: the Supabase Studio Table Editor may be degraded, since parts of Studio read
through PostgREST. `npx prisma studio` is the substitute and matches our schema exactly.

**2026-08-07 — Prisma 7 conventions differ sharply from Prisma 5/6. Verified empirically, not
assumed.** Installed version is **7.9.1**. Three breaking differences that will mislead any agent
working from older knowledge:

1. **`url` and `directUrl` are rejected in `schema.prisma`.** Error P1012. Connection URLs now live
   in `prisma.config.ts` under `datasource`. The schema's `datasource` block carries only `provider`.
2. **Prisma does not auto-load `.env`, and never loaded `.env.local`.** `prisma.config.ts` bridges it
   with `process.loadEnvFile('.env.local')` (native in Node 20.12+; we are on Node 24), wrapped in
   try/catch so Vercel and CI — which inject env vars directly — don't fail on a missing file.
3. **The runtime client requires a driver adapter.** `PrismaClient` no longer takes a connection URL;
   it needs an `adapter` (e.g. `@prisma/adapter-pg`) or `accelerateUrl`. Still to be wired up.

The config datasource uses **`DIRECT_URL`** (session pooler, 5432) because Migrate runs DDL, which a
transaction pooler cannot. `DATABASE_URL` (6543) is for runtime queries through the adapter.

Also note the default generator provider in Prisma 7 is `prisma-client`, not `prisma-client-js`, and
it requires an explicit `output` path.

**2026-08-07 — Schema design decisions.** Beyond what PLAN.md §4 specifies:

- **Two currency enums, not one.** `AccountCurrency` (USD/GBP/EUR/MYR) for journal bases and the
  user's display currency; `Currency` (18 values) for instrument quote currencies. This puts the
  constraint in the type system — TypeScript refuses a JPY-denominated journal — rather than leaving
  it to a runtime check. It also keeps the FX table minimal: rates run *from* `Currency` *into*
  `AccountCurrency`, never between arbitrary pairs.
- **`Trade.userId` is denormalised** from `journal.userId`. Every tenant-scoped query would otherwise
  need a join, and the `prismaForUser` extension filters on a direct column.
- **`Rule` → `TradeRuleCheck` is `onDelete: Restrict`, not Cascade.** Deleting a rule must not erase
  the record of having broken it. Rules retire via `isActive`. This is the honest-history principle
  enforced at the schema level rather than trusted to the UI.
- **`Instrument` → `Trade` is `Restrict`** for the same reason; **`User` → everything is `Cascade`**
  so account deletion genuinely removes the data.
- **`uuid(7)` primary keys**, not `uuid(4)`. UUIDv7 is time-sortable, which keeps index locality
  reasonable as the trade table grows. `User.id` has no default — it is supplied by Supabase Auth.
- **Decimal precisions:** prices `(24,10)` to cover crypto and JPY pairs alike; money `(18,4)`; sizes
  and contract sizes `(18,8)` for fractional crypto units; FX rates `(20,10)`.
- **Table names are snake_case via `@@map`**, so raw SQL in migrations and RLS policies reads
  naturally against Postgres conventions.
- **`ReminderSchedule.localTime` is `VarChar(5)` holding "HH:MM"**, not a timestamp — a wall-clock
  reminder must survive DST changes, which an instant would not.

**2026-08-07 — Hosting and branching guidance (user action pending).**
Vercel confirmed as the right host. Two things flagged: Vercel functions default to `iad1`
(Washington DC) while the database is in Singapore, so the project's function region must be set to
`sin1` or every query crosses the Pacific; and the Hobby tier is non-commercial, so paying users
require Pro.

Branching: `main` protected, feature branches via PR, CI as a required status check, Vercel preview
per PR, admin bypass left enabled since the user works solo. **Migrations stay manual** —
`prisma generate` runs at build, `prisma migrate deploy` does not. This is the same reasoning that
led to disconnecting Supabase's GitHub integration: schema changes against real trades need a human.

A second Supabase project for dev/previews is not needed yet — Phase 0 CI is lint, typecheck, and
pure unit tests. Add it before Phase 1 ends, while there is still no real data to protect.

**2026-08-07 — `main` is protected by a GitHub ruleset named `protect-default-branch`.**
Active, targeting the default branch. Requires a pull request (0 approvals — GitHub will not let a
solo developer approve their own PR, and requiring 1 would lock the repository), requires the
**`verify`** status check from [ci.yml](../.github/workflows/ci.yml), restricts deletions, blocks
force pushes, and requires linear history with **squash-only** merges so each PR lands as exactly one
Conventional Commit.

Repository admin is on the bypass list to avoid lockout during a hotfix. Note this means direct
pushes to `main` still succeed for the owner — the ruleset is a prompt rather than a wall. Tightening
the bypass to "pull requests only" would make it binding.

Working loop from here: branch → commit → push → PR → CI and Vercel preview → squash-merge.

**2026-08-07 — GitHub Advanced Security enabled.** The repository is **public**, which is why secret
scanning is available at no cost. Enabled: private vulnerability reporting, dependency graph,
Dependabot alerts, Dependabot security updates (grouped), Dependabot malware alerts, CodeQL default
setup, Secret Protection, and **push protection** — which blocks any push containing a recognised
credential. That last one is the platform-level backstop for the `git add .` workflow, sitting behind
`.gitignore` and the mandatory `git status` check.

Deliberately **off**: Dependabot *version* updates (security updates already cover what matters;
version updates would flood the repo with PRs for Next, React, Prisma and Tailwind bumps), and
automatic dependency submission (npm's lockfile already gives GitHub the full tree).

`protect-default-branch` additionally requires **CodeQL** code-scanning results at High-or-higher
severity. If a PR ever stalls waiting on CodeQL — it can happen on docs-only changes — use the admin
bypass rather than removing the rule.

**2026-08-07 — RLS: enabled everywhere, zero policies, and that is the finished state.**
Verified after the first migration rather than assumed. Supabase's automatic-RLS event trigger fires
on Prisma-created tables, so all 13 tables in `public` came out with `relrowsecurity = true` and no
policies. In Postgres that combination **denies all access** to any role lacking `BYPASSRLS`.

This supersedes the original plan to write `auth.uid()` policies into the initial migration. Adding
permissive policies now would *widen* access from "nothing" to "something", which is the wrong
direction while the Data API is off. Policies become necessary only if the Data API or Realtime is
later enabled.

Confirmed by direct query: Prisma connects as **`postgres`**, which has `rolbypassrls = true`. RLS
therefore does nothing to constrain Prisma — exactly as PLAN.md §3.1 predicted, and exactly why the
`prismaForUser` guardrail is the actual tenancy control rather than a belt-and-braces extra.

**2026-08-07 — `prismaSystem` exists as a documented exception to the module-private rule.**
CLAUDE.md originally said the unscoped client is never exported. That was unworkable: seeding the
instrument catalogue, writing the FX cache, creating the `User` row at signup, and the reminder cron
all legitimately need unscoped access. Rather than quietly violating the rule, it is now an explicit
export with a name that makes misuse visible in review and greppable in a diff, plus an enumerated
list of the only four permitted uses. CLAUDE.md §5.1 updated to match.

**2026-08-07 — Tenancy rules live in a pure module, separate from the Prisma wiring.**
[lib/tenancy.ts](../lib/tenancy.ts) holds `scopeQuery()` — no imports, no side effects, takes an
operation and returns rewritten args or throws. [lib/db.ts](../lib/db.ts) is now only the client
wiring and a one-line extension that delegates to it.

This is not tidiness for its own sake. The control keeping one trader's book out of another's needs
to be exhaustively testable without a database, a session, or a running app — and extracting it is
what surfaced the ownership-reassignment hole below. Keep new tenancy rules in the pure module.

**2026-08-07 — Fixed: a scoped client could give a row away.**
The first implementation scoped `where` and stamped `create`, but nothing stopped
`update({ where: { id }, data: { userId: someoneElse } })`. That passes the tenant filter — the caller
genuinely owns the row at that moment — and then transfers it to another user. Reads and creates were
guarded; the *transition* was not.

`scopeQuery` now throws on any attempt to set the owner column in `update`, `updateMany`, or the
`update` branch of `upsert`. Reassigning ownership is never legitimate through a user-scoped client.

Worth remembering as a pattern: guarding "who can read this" and "who can create this" is not the
same as guarding "who can this become".

---

## Session log

*Append-only, newest first.*

### 2026-08-07 — Instrument catalogue seeded

Added [prisma/instruments.ts](../prisma/instruments.ts) (the data) and
[prisma/seed.ts](../prisma/seed.ts) (the runner), plus `tsx` to execute TypeScript scripts without a
build step. `npm run db:seed`.

**55 instruments seeded and verified in the live database:** 35 FX (majors, crosses, exotics), 2
metals, 10 indices, 8 crypto. Run twice to confirm idempotency — second run reported
`created 0, updated 55`.

The seed uses `prismaSystem`, which is one of its four sanctioned uses: the catalogue is shared
reference data with no owner, and `prismaForUser` refuses to write it. The `update` branch
deliberately does not touch `isActive`, so re-seeding cannot resurrect an instrument an operator
retired by hand.

Contract specs carry the common retail defaults, with gold at **100 oz/lot** and silver at
**5,000 oz/lot** rather than the 100,000 used for FX — the most common source of wrong P/L in retail
journals. Index and crypto specs vary by broker, which is what `InstrumentOverride` and the
per-trade `pnlOverride` exist for.

Two bugs worth recording, both caught before commit:

- **ESM import hoisting.** `seed.ts` called `process.loadEnvFile()` in the module body, but static
  imports are evaluated first, so `lib/db.ts` ran and threw on the missing `DATABASE_URL` before the
  env file was ever read. Fixed by importing `lib/db` dynamically inside `main()`. Any module that
  reads env at import time has this hazard.
- **Seed data typed as `string` rather than the generated enums.** Compiled locally but failed
  typecheck against Prisma's input types. Now typed against `Currency`, `InstrumentKind` and
  `SizingMode` from the generated client, so a mistyped currency fails to compile rather than at
  insert.

Full sequence verified green: lint, typecheck, 36 tests, prisma validate, build.

### 2026-08-07 — Tenancy guardrail proven by tests

Added **Vitest** and [lib/tenancy.test.ts](../lib/tenancy.test.ts) — **36 tests**, all passing. The
guardrail is now demonstrated rather than asserted, closing the gap flagged in the previous session.

Coverage: every filterable operation is constrained; a caller-supplied `userId` in `where` is
AND-wrapped so it matches nothing rather than someone else's rows; forged owner ids in `create` and
`createMany` payloads are overwritten; parent-owned models filter through the relation and refuse
direct creates; shared reference data is readable but not writable; `User` scopes on `id` rather than
`userId`; and an unclassified model throws instead of leaking.

**Found and fixed a genuine vulnerability while writing these** — see the decision above on ownership
reassignment. It existed in the code merged in PR #1.

Refactored the rules into [lib/tenancy.ts](../lib/tenancy.ts) as pure functions. `scopeQuery` is
generic over the args type so Prisma's per-operation types flow through the extension; one documented
cast at the return covers the shape Prisma's types cannot express.

`vitest.config.mts` uses the `.mts` extension deliberately — as `.ts` it loads as CommonJS and Vite
warns about ESM syntax.

CI now runs `npm test` between typecheck and Prisma validation. Full local sequence verified green:
lint, typecheck, test, validate, build.

### 2026-08-07 — Fixed CI: typecheck needs `next typegen` first

CI had been red since it was added, on `main` and on PR #1. The failing step was **Typecheck**, which
passed locally and failed on the runner.

Cause: Next 16 generates global route types — including `LayoutProps`, used by
[app/layout.tsx](../app/layout.tsx) — into `.next/types/`, and generates `next-env.d.ts`. Both are
gitignored, and both are listed in [tsconfig.json](../tsconfig.json)'s `include`. A developer's
machine has them because `next dev`/`next build` has run; a clean CI checkout does not. So `tsc` ran
before the types existed and failed with `TS2304: Cannot find name 'LayoutProps'`.

Reproduced locally by moving `next-env.d.ts` and `.next/` aside, which produced the identical error.

Fix: `typecheck` is now `next typegen && tsc --noEmit`. Next 16 ships `next typegen` for exactly this
— it generates route types without a full build. Putting it in the npm script rather than only in the
workflow means a fresh clone typechecks correctly for a human too.

**Lesson worth keeping:** any CI failure that cannot be reproduced locally usually comes from a
gitignored artefact the local machine has and a clean checkout does not.

### 2026-08-07 — First migration applied; tenancy guardrail built

Installed `@prisma/adapter-pg` (bundles `pg`, no separate install needed). Prisma 7's `PrismaClient`
takes `{ adapter }` rather than a connection URL.

Wrote [lib/db.ts](../lib/db.ts): the pooled client behind a hot-reload-safe singleton, plus
`prismaForUser(userId)` built on a Prisma client extension. It classifies every model as directly
owned (`userId`/`id` column), owned via a parent relation, or shared reference data, and:

- injects the owner predicate into `where` for all filterable operations
- stamps the owner column onto `create` / `createMany` / `upsert` payloads, so a caller cannot forge
  someone else's id — the injected value wins
- refuses direct creates of parent-owned models (`TradeImage`, `TradeRuleCheck`,
  `InstrumentOverride`), forcing them through a nested write on an already-scoped parent where
  ownership is provable
- refuses writes to shared reference data
- **throws for any model missing a tenancy rule**, so a future schema addition fails loudly rather
  than silently becoming world-readable

Key enabler, verified against the generated types: Prisma's extended where-unique means
`TradeWhereUniqueInput` accepts `userId` as a filter. That allows `findUnique`, `update` and `delete`
to be scoped uniformly alongside `findMany` — no operation is left unguarded.

Ran `prisma migrate dev --name init`. Migration `20260807075919_init` created and applied; Supabase's
session pooler permitted shadow-database creation, so `migrate dev` works normally. **13 tables now
exist.** Typecheck clean.

### 2026-08-07 — CI workflow and Vercel region

Added [.github/workflows/ci.yml](../.github/workflows/ci.yml) running on PRs to `main` and pushes to
`main`: install, lint, typecheck, `prisma validate`, build. Job name is **`verify`** — that is the
string to select as a required status check in branch protection. All four steps verified passing
locally before commit.

The workflow sets placeholder `DATABASE_URL` / `DIRECT_URL` values. These are not credentials and CI
has no database access; they exist because `prisma.config.ts` resolves `DIRECT_URL` at load time and
would throw on a missing variable, which would break `npm ci`'s postinstall.

Added [vercel.json](../vercel.json) pinning `regions: ["sin1"]`. Chosen over the dashboard setting so
the region is version-controlled and cannot drift — the database is in Singapore, and Vercel's
default `iad1` would route every query through Virginia.

**Sequencing note for whoever sets up branch protection:** GitHub cannot offer `verify` as a required
check until the workflow has run at least once. Push it to `main` first, then add the rule.

### 2026-08-07 — Database schema authored

Wrote the full [prisma/schema.prisma](../prisma/schema.prisma): 12 models and 9 enums covering
identity, journals, the instrument catalogue with per-journal overrides, trades with the plan/outcome
split, chart images, the rule and rule-check habit layer, daily reviews, the FX rate cache, and the
Phase 4 push tables. Every money, price, size and rate field is `Decimal`.

`prisma validate` passes, `prisma format` applied, `prisma generate` produces a client in
`lib/generated/prisma` (gitignored), and `tsc --noEmit` is clean.

Added npm scripts: `typecheck`, `db:generate`, `db:migrate`, `db:deploy`, `db:studio`, and a
`postinstall` running `prisma generate` so Vercel builds have a client.

**No migration has been run.** The database is still empty by design — the schema is for review
first.

### 2026-08-07 — Prisma installed, live database connection verified

Verified `.env.local` with a throwaway script that parses and reports only shapes, hosts, and key
prefixes — never a password. Caught two problems: the URLs initially held the template placeholders
rather than real values, and once filled, the generated database password contained a `?`, which
begins a URL query string and left the connection string with no hostname. It also contained a double
quote, which is hazardous inside a double-quoted dotenv value. Resolved by resetting the password to
32 alphanumeric characters rather than percent-encoding — the encoding fix would have addressed only
the `?`.

Installed `prisma` and `@prisma/client` 7.9.1. Added [prisma.config.ts](../prisma.config.ts) and a
minimal [prisma/schema.prisma](../prisma/schema.prisma) with the datasource provider only.

`npx prisma migrate status` now connects successfully to
`aws-0-ap-southeast-1.pooler.supabase.com:5432` and reports no migrations, which is the correct state
for a fresh project. **The database connection is proven end to end.**

Installed `dotenv-cli` then removed it — `process.loadEnvFile` made it unnecessary, and CLAUDE.md
§5.6 treats every dependency as attack surface.

No models defined yet.

### 2026-08-07 — Supabase project created

Project **Diarylah** created on the free tier, Asia-Pacific region. Security settings as recorded in
the decision above: Data API off, auto-expose off, automatic RLS on.

Added [.env.example](../.env.example) documenting every variable Phase 0 needs, with inline notes on
the pooler-versus-direct port split and the password percent-encoding trap.

**Outstanding:** the Supabase GitHub integration is still connected. It has write access to the repo
and can auto-apply migrations on push, which collides with Prisma Migrate as the single schema owner.
User has the disconnect steps (Supabase Settings → Integrations, and
github.com/settings/installations). Low risk in the meantime — the integration looks for
`supabase/migrations/` and Prisma writes to `prisma/migrations/`, so it has nothing to deploy.

### 2026-08-07 — Switched to one-shot commits

Adopted the user's preferred git workflow: `git add .` plus a single commit per task. Rewrote
CLAUDE.md §6 and §7 accordingly, replacing the explicit-staging rule and the split-commit guidance
with dominant-type subject lines and enumerated bodies.

Added the compensating security controls described in the decision above, and fixed `.gitignore` so
`.env.example` is committable while `.env*` stays ignored.

### 2026-08-07 — Named the project Diarylah

Applied the name across `package.json`, [CLAUDE.md](../CLAUDE.md), [PLAN.md](PLAN.md), and this file.
Replaced the default `create-next-app` [README.md](../README.md) with a real project README covering
the north star, planned capabilities, stack, and documentation map — written to be honest that
nothing is implemented yet.

Directory rename and GitHub repo creation are left to the user, who runs all git operations manually.
No application code written.

### 2026-08-07 — Agent instructions and handoff established

Wrote [CLAUDE.md](../CLAUDE.md) covering the product north star, the read-first working agreement,
the security ruleset, git and Conventional Commits policy, and code conventions. Created this
handoff file and backfilled the decision log from the planning conversation.

Verified against `node_modules/next/dist/server/lib/generate-agent-files.js` that project
instructions in CLAUDE.md are safe from `next dev` regeneration.

Established two standing rules: **the user runs all git and GitHub commands manually** (agents
suggest only), and **every task ends by updating this file**.

No application code written.

### 2026-08-06 — Planning

Scoped the stack and wrote [docs/PLAN.md](PLAN.md). Worked through the Prisma-versus-Supabase
question, the multi-tenancy security implications, the cross-asset P/L formula, the multi-currency FX
architecture, and the PWA push constraints. Settled the decisions recorded above.

---

## Next up

**Phase 0 — Foundation.** Remaining, in order:

1. ~~Create the Supabase project; capture credentials.~~ **Done.**
2. ~~Install and configure Prisma; confirm the connection.~~ **Done.**
3. ~~Author the schema from [PLAN.md §4](PLAN.md).~~ **Done, awaiting review before migrating.**
4. ~~Generator, gitignore, `postinstall`.~~ **Done.**
5. ~~Wire the runtime client with `@prisma/adapter-pg`.~~ **Done.**
6. ~~Run the first migration.~~ **Done** — `20260807075919_init`, 13 tables, RLS on, no policies
   needed (see the decision above).
7. ~~Build the `prismaForUser` extension and prove it.~~ **Done** — 36 passing tests in
   [lib/tenancy.test.ts](../lib/tenancy.test.ts). One remaining gap: these prove the *rewriting* is
   correct, not that Postgres then behaves as expected. An integration test against a real database
   is worth adding once a separate dev Supabase project exists.
8. ~~Seed the instrument catalogue.~~ **Done** — 55 instruments live, `npm run db:seed`, idempotent.
9. Wire Supabase Auth: email + Google, and settle identity-linking behaviour. Create the `User` row
   on first sign-in.
10. Deploy to Vercel and confirm the pooled connection works in a serverless runtime.

Nothing user-facing beyond login ships in this phase.

---

## Known issues & deferred

- **Identity linking is unresolved.** If a user signs up with Google then signs in with X on the same
  email, Supabase may create a second account and they will find an empty journal. Must be configured
  and tested before launch.
- **X/Twitter OAuth unconfirmed.** Verify the developer portal still permits login at the intended
  tier before promising it in the UI.
- **Partial closes and scaling out are not modelled.** One entry, one exit per trade. Supporting
  partials means a `TradeExecution` child table and weighted-average exit price. Deferred, but the
  schema should not actively block it.
- **Instrument catalogue maintenance is manual.** Mitigated by the two override layers.
- **USDT-quoted crypto.** Decide whether to treat it as 1:1 with USD (acceptable for a journal) or
  rate it properly.
- **Prop firm rules** (max daily loss, max drawdown, breach warnings) are a natural fit for the habit
  theme but out of MVP scope.
- **Offline writes** for trade entry are deferred past MVP.
