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

**Phase:** Pre-Phase 0 — planning complete, implementation not started.

**What exists:**

- An unmodified `create-next-app` scaffold: Next.js 16.3.0, React 19.2.8, TypeScript, Tailwind v4,
  App Router at [app/](../app/). Default landing page, untouched.
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

Nothing configured yet. Phase 0 will need:

- A Supabase project (Postgres + Auth + Storage).
- `.env.local` with `DATABASE_URL` (transaction pooler, port 6543, `?pgbouncer=true`) and
  `DIRECT_URL` (direct connection, port 5432, used by Prisma Migrate only).
- Supabase URL and `anon` key for the browser client; service role key server-only.
- A Google OAuth client for social login.
- An `.env.example` committed with variable names and no values.

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

---

## Session log

*Append-only, newest first.*

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

**Phase 0 — Foundation.** In rough order:

1. Create the Supabase project; capture connection strings and keys into `.env.local` and
   `.env.example`.
2. Install and configure Prisma against the Supabase pooler; confirm `DATABASE_URL` /`DIRECT_URL`
   split works for both runtime queries and migrations.
3. Author the schema from [PLAN.md §4](PLAN.md).
4. Write RLS policies as raw SQL in the initial migration.
5. Build the `prismaForUser` client extension and prove the tenancy guardrail with a test.
6. Wire Supabase Auth: email + Google, and settle identity-linking behaviour.
7. Seed the instrument catalogue.
8. Deploy to Vercel and confirm the pooled connection works in a serverless runtime.

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
