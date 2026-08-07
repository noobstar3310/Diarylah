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

---

## Session log

*Append-only, newest first.*

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
3. **Author the schema** from [PLAN.md §4](PLAN.md). `Decimal` on every money and price field. Show
   it for review before running any migration.
4. Add the `prisma-client` generator with an explicit output path, gitignore the generated client,
   and add a `postinstall` generate step for Vercel builds.
5. Wire the runtime `PrismaClient` with a driver adapter (`@prisma/adapter-pg`) against the pooled
   `DATABASE_URL`.
6. Write RLS policies as raw SQL in the initial migration.
7. Build the `prismaForUser` client extension and prove the tenancy guardrail with a test.
8. Wire Supabase Auth: email + Google, and settle identity-linking behaviour.
9. Seed the instrument catalogue.
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
