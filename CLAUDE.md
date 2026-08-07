@AGENTS.md

# Diarylah — Agent Instructions

These instructions govern all work in this repository. Read them fully before your first edit.

---

## 1. North star

**This app exists to build the qualities of a profitable trader in the person using it.**

That is the goal. Not to record trades. Not to draw charts. The journal, the analytics, the
reminders — all of it is instrumentation in service of behaviour change. A trader who logs a hundred
trades and changes nothing has been failed by this product.

The mechanism: rule-adherence is captured as a property of every logged trade, so discipline is
**measured from evidence rather than self-reported**. The headline number the whole app builds
toward is:

> *Your expectancy when you followed every rule, versus when you didn't.*

### The decision test

When a design or implementation choice is ambiguous, apply this test:

> Does this make the user more likely to notice, and correct, an undisciplined habit?

Prefer the option that scores higher, even when it is the harder build or the less flattering UI.
Concretely, this means:

- **Honest over comfortable.** Never round a loss down, hide a broken rule, or default a field to the
  flattering value. If the user skipped a stop loss, the app says so.
- **Derived over declared.** Compute facts from data wherever possible instead of asking the user to
  assert them. A self-graded discipline score is worth nothing.
- **Friction where it teaches.** Logging a stop loss is required, not optional, because requiring it
  builds the habit. Do not optimise away friction that is doing pedagogical work.
- **Immutable history.** A journal that silently rewrites the past cannot be trusted, and a record
  the user does not trust cannot change behaviour. See the FX snapshot rule in the plan.

---

## 2. Required reading, in order

| File | What it is | When to read |
|---|---|---|
| [docs/PLAN.md](docs/PLAN.md) | The technical spec: stack, security model, schema, P/L engine, phases | Before any implementation work |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Living project state: what exists, what's next, decisions made | **At the start of every single task** |
| `node_modules/next/dist/docs/` | The bundled docs for *this* Next.js version | Before writing any Next.js code |

PLAN.md is the intended design. HANDOFF.md is the current reality. When they disagree, reality wins —
update the plan or fix the code, but never leave the contradiction silently in place.

---

## 3. Working agreement — every task, without exception

1. **Read [docs/HANDOFF.md](docs/HANDOFF.md) first** to load the current state of the project. Do not
   assume continuity from earlier in a conversation; the handoff is the source of truth.
2. **Check the relevant section of PLAN.md** for the piece you are about to build.
3. **Read the bundled Next.js docs** for any framework API you are about to use. This Next version
   differs from training data — see AGENTS.md.
4. **Do the work**, applying the security rules in §5 as you go.
5. **Update [docs/HANDOFF.md](docs/HANDOFF.md)** before reporting completion — see §4.
6. **Suggest the git commands.** Never run them — see §6.

Step 5 is not optional and is not "if there's time". A change that is not reflected in the handoff
did not happen, as far as the next agent is concerned.

---

## 4. The handoff protocol

[docs/HANDOFF.md](docs/HANDOFF.md) is how continuity survives across sessions, agents, and models.
Treat it as the project's memory.

**Read it at the start of every prompt.** Even a small follow-up. It tells you what is already built,
what is half-built, what was deliberately deferred, and what is currently broken.

**Update it at the end of every task**, once the work is actually done and verified:

- **Current state** — rewrite this section so it is an accurate snapshot. It describes what *is*, not
  what changed. Stale entries here are worse than no entries.
- **Session log** — append a dated entry: what was done, why, and anything the next agent needs to
  know. Append-only; never rewrite past entries.
- **Decisions** — append any architectural or product decision made, with its reasoning. A decision
  without a recorded "why" will be relitigated or accidentally reversed.
- **Next up** — rewrite to reflect the current best next step.
- **Known issues / deferred** — record anything left broken, stubbed, or knowingly incomplete. Being
  explicit about debt is required; quietly leaving it is not acceptable.

Record failures and abandoned approaches too. "We tried X, it didn't work because Y" saves the next
agent hours and is often more valuable than the successes.

---

## 5. Security — non-negotiable

This app is multi-user, open to public signup, and holds financial records. Security is a design
constraint, not a later hardening pass. **Architect every feature with maximum security in mind.**

Where a secure approach costs more effort than an insecure one, take the secure approach. If a
security control blocks progress, **raise it — never weaken it to unblock yourself or to make a test
pass.**

### 5.1 Authentication and tenancy

- Every Server Action and Route Handler **authenticates first**, before any other logic.
- **Never accept a user id from the client.** Derive it from the verified session, always.
- Any client-supplied id (`journalId`, `tradeId`, `ruleId`, …) is untrusted. **Verify ownership**
  against the session user before reading or writing through it. An IDOR here exposes another
  trader's entire book.
- All database access goes through `prismaForUser(userId)` in [lib/db.ts](lib/db.ts). It rewrites
  every query to filter on the owner, stamps the owner column on creates, and throws for any model
  that has no declared tenancy rule — so adding a model without deciding how it is owned fails loudly
  instead of exposing it.
- `prismaSystem` is the **only** exported unscoped client and the one deliberate exception. It is
  legitimate for exactly four things: seeding the shared `Instrument` catalogue, writing the `FxRate`
  cache, creating the `User` row at signup before a scoped client can exist, and the cron job that
  fans out reminders. **Never import it into a Server Action that handles user input.** If you are
  reaching for it to serve a signed-in user's request, you want `prismaForUser`.
- **Row Level Security stays enabled on every table, with zero policies.** RLS with no policies denies
  all access to roles that do not bypass it — the strictest posture available, and correct while the
  Data API is disabled. Do not add permissive `auth.uid()` policies "for completeness"; that widens
  access. Policies become necessary only if the Data API or Realtime is ever enabled. Never disable
  RLS itself, in any environment.

### 5.2 Input handling

- **Zod-validate every external input** — Server Action arguments, route params, search params,
  webhook bodies — at the boundary. Parse into a typed value; never cast an `any` through.
- Never use `$queryRawUnsafe` or `$executeRawUnsafe`. Parameterised queries only.
- Validate uploads server-side: size cap, allowlisted MIME type confirmed against magic bytes, and a
  per-trade image count cap. The client's `Content-Type` is a suggestion, not evidence.
- Strip EXIF metadata from uploaded images — screenshots taken on a phone can carry location data.

### 5.3 Secrets and data exposure

- Only genuinely public values may carry the `NEXT_PUBLIC_` prefix. Audit every use of it.
- `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` and equivalents are **server-only**
  and must never be imported into a Client Component or reachable from client bundles.
- Never commit `.env*`. Keep `.env.example` with variable *names* and no values.
- Never log secrets, tokens, session identifiers, or whole user records. Log ids, not payloads.
- Error messages returned to the client must not leak schema details, stack traces, or whether a
  given record exists. Log the detail server-side; return something generic.

### 5.4 Storage

- Screenshot buckets are **private**. Access is via short-TTL signed URLs only.
- Every object path is prefixed with the authenticated user's id.
- Uploads go browser → Supabase Storage using a signed upload URL minted server-side after an
  authorization check. Large images must not transit the Next.js server.

### 5.5 Transport and abuse

- Set the security headers described in the Next.js PWA guide: `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, and a Content Security Policy.
- Rate-limit anything that is expensive or attackable: auth attempts, uploads, and any path that
  calls a third-party API.
- Cache FX rates. Never let user traffic fan out into uncontrolled external API calls.

### 5.6 Dependencies

Every new dependency is attack surface. Justify it, prefer platform APIs and the already-chosen
stack, and avoid unmaintained or thinly-used packages for anything touching auth, money, or files.

**When a security question is genuinely ambiguous, choose the more restrictive option and flag it in
the handoff.**

---

## 6. Git — suggest, never execute

**The user runs all git and GitHub commands manually.** Do not run `git add`, `git commit`,
`git push`, `git branch`, `git checkout`, `git merge`, `git rebase`, `git tag`, `git reset`, or any
`gh` command. Read-only inspection (`git status`, `git diff`, `git log`) is fine when it helps you
understand the working tree.

At the end of every task, output **one** copy-pasteable block: a single `git add .` and a single
commit covering the whole task. The user stages everything at once and prefers one commit per task
over split commits. Do not suggest breaking a task into several commits unless asked.

The user is on **Windows PowerShell**, so use `-m` flags rather than here-strings, which break when
pasted:

```powershell
git add .
git commit -m "feat(trade): add trade entry form" -m "- clipboard paste and file upload
- live P/L preview against instrument contract specs
- updates handoff"
```

**Only ever put runnable commands inside a ```powershell block.** Command *output* — `git status`
results, error text, logs — goes in a plain block with a label, or in a table. A bare code block
next to a real command reads as copy-pasteable, and pasting `git status` output into a shell
produces a wall of "term not recognized" errors.

### `.gitignore` is a security control

Because staging is unconditional, `.gitignore` is the only thing standing between `.env.local` — which
holds the database URL, Supabase service role key, and VAPID private key — and a public repository.
Treat it as security infrastructure, not housekeeping:

- Any change introducing a file that holds secrets, credentials, tokens, or local-only state **must**
  add its pattern to `.gitignore` in that same change, before the commit is suggested.
- **Run `git status --short` and actually read it before suggesting the commit.** If anything
  unexpected is staged — a secret, a build artefact, a stray scratch file, an unrelated edit — say so
  plainly and fix the ignore rules first. This check is not optional; it is the compensating control
  for `git add .`.

Never suggest `--no-verify`, `--force`, or history rewriting.

Note: `next dev` rewrites the managed block in AGENTS.md. If it appears in the diff, include it in the
commit rather than reverting it — reverting only re-creates the change.

---

## 7. Commit messages — Conventional Commits v1.0.0

Every suggested commit follows <https://www.conventionalcommits.org/en/v1.0.0/>.

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

### Rules

- A type is **required**, followed by an optional scope in parentheses, an optional `!`, then a
  **colon and a space**.
- `feat` — adds a new feature. `fix` — patches a bug. These two are mandated by the spec.
- The description is a concise summary in the **imperative mood**, lowercase, with no trailing full
  stop. *"add trade entry form"*, not *"Added trade entry form."*
- The body, if present, begins **one blank line** after the description. Use it for *why*, not *what*
  — the diff already shows what.
- Footers begin one blank line after the body. Tokens use `-` instead of spaces, e.g. `Reviewed-by`.
- **Breaking changes** are marked with `!` before the colon, and/or a `BREAKING CHANGE:` footer.
  `BREAKING CHANGE` must be uppercase. Any schema migration that is not backward-compatible qualifies.

### Types used in this repo

| Type | Use for |
|---|---|
| `feat` | new user-facing capability |
| `fix` | bug fix |
| `docs` | documentation only, including PLAN.md and HANDOFF.md |
| `refactor` | restructuring with no behaviour change |
| `perf` | performance improvement |
| `test` | adding or correcting tests |
| `build` | dependencies, build config, Prisma generation |
| `ci` | pipeline configuration |
| `chore` | maintenance that fits nothing above |
| `revert` | reverting a previous commit |

### Scopes used in this repo

`auth` · `db` · `journal` · `trade` · `pnl` · `fx` · `rules` · `review` · `analytics` · `pwa` ·
`push` · `storage` · `ui` · `security` · `config`

### Examples

```
feat(trade): compute P/L from instrument contract specs
fix(fx): carry forward last rate for weekend fills
feat(db)!: split planned TP/SL from actual exit price
docs: record FX snapshot decision in handoff
```

Since a commit covers a whole task (see §6), it will often span several concerns. In that case pick
the **dominant** type and scope for the subject line, and enumerate the rest as bullets in the body:

```
feat(trade): add trade entry form

- clipboard paste, drag-drop, and file upload to private storage
- live P/L preview against instrument contract specs
- adds MAX_UPLOAD_BYTES to .env.example
- updates handoff
```

The subject describes the headline change; the body carries everything else. Do not stretch the
subject to cover unrelated work.

---

## 8. Code conventions

- **TypeScript strict.** No `any` in application code. No `@ts-ignore` without an adjacent comment
  explaining why it is unavoidable.
- **Money and prices are `Decimal`, never `Float`.** Use Prisma's `Decimal` type and decimal-safe
  arithmetic for every price, size, P/L, fee, and FX rate. IEEE-754 floats accumulate error across
  summed trades and will silently produce a wrong equity curve — in an app whose entire value rests
  on the user trusting its numbers.
- **Server Components by default.** Add `'use client'` only where interactivity genuinely requires
  it, and push it to the leaves of the tree.
- **Mutations go through Server Actions**, each one authenticating and validating before touching
  data.
- **Pure domain logic stays framework-free.** The P/L, FX, and R-multiple calculations belong in
  plain, unit-testable modules with no React or Next imports. These are the highest-value tests in
  the codebase; write them alongside the logic.
- **Timezone discipline.** Timestamps are `timestamptz`. Every notion of "day" derives from the
  user's stored timezone, never from server UTC. See PLAN.md §6.
- Match the surrounding code's naming, structure, and comment density. Comment *why*, not *what*.

---

## 9. Scope discipline

Build what was asked. If you spot a real problem with the request, say so in a sentence or two, then
deliver the full scope under stated assumptions — do not silently narrow, widen, or substitute the
work. If part of a task turns out to be blocked, complete everything else and state plainly what was
left undone and why.

Report honestly. If tests fail, show the output. If a step was skipped, say so. Never describe work
as complete and verified unless it is both.
