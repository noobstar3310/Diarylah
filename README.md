# Diarylah

A trading journal that exists to build the qualities of a profitable trader.

Most journals record what you did. Diarylah measures whether you did it *the way you said you would*
— then puts the difference in front of you every day until it changes.

Rule-adherence is captured as a property of every logged trade, so discipline is measured from
evidence rather than self-reported. Everything in the app builds toward one number:

> **Your expectancy when you followed every rule, versus when you didn't.**

---

## Status

**Planning complete, implementation not started.** The repository currently holds the technical plan
and agent instructions on top of an unmodified Next.js scaffold. See
[docs/HANDOFF.md](docs/HANDOFF.md) for the live project state.

## Planned capabilities

- **Journals** — several per user, each simulating a separate trading account with its own base
  currency (USD, GBP, EUR, MYR).
- **Trade logging** — entry and exit times and prices, planned stop loss and take profit, position
  size, fees, and chart screenshots pasted straight from the clipboard or uploaded from file.
- **Cross-asset P/L** — forex, metals, indices, and crypto through a single contract-spec model, with
  exchange rates snapshotted at write time so historical records never shift.
- **R-multiple as the primary metric** — currency-agnostic and comparable across every instrument and
  journal.
- **Personal rule checklist** — your own definition of a good trade, checked off per trade.
- **Analytics** — equity curve, expectancy, profit factor, drawdown, and performance cut by
  instrument, session, and day, all overlaid against rule adherence.
- **PWA with push reminders** — installable on iOS and Android, with server-scheduled nudges.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage) ·
Prisma · Vercel

Full rationale in [docs/PLAN.md](docs/PLAN.md).

## Documentation

| File | Contents |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Technical plan — stack, security architecture, data model, P/L and FX engine, analytics, build phases |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Living project state, decision log, and session history |
| [CLAUDE.md](CLAUDE.md) | Instructions for AI agents working in this repository |

## Development

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

Environment setup is not yet defined — it lands in Phase 0 alongside Supabase and Prisma. See
[docs/HANDOFF.md](docs/HANDOFF.md#next-up).

---

*Diary + "lah". Because a journal that nags you in your own accent is harder to ignore.*
