# Diarylah — Technical Plan

> Status: planning. No implementation yet.
> Last updated: 2026-08-07

## 1. What this app is

Two products that share one data model:

1. **A habit coach** — constantly reflects back whether the user is behaving like a profitable trader.
2. **A trading journal** — records every trade with full P/L, screenshots, and analytics.

These are deliberately *not* separate features. Rule-adherence is recorded as a property of each
logged trade, so the habit score is **derived from journal data** rather than self-reported
checkboxes. The headline metric of the whole product is:

> *Your expectancy when you followed every rule, versus when you didn't.*

Everything else exists to make that number trustworthy and hard to ignore.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.3 (App Router) | already scaffolded, `app/` at repo root |
| UI runtime | React 19.2 | |
| Language | TypeScript | strict mode |
| Styling | Tailwind v4 + shadcn/ui | Tailwind already configured |
| Database | Supabase Postgres | |
| ORM / migrations | **Prisma** | schema source of truth, typed client |
| Auth | Supabase Auth | email + Google at launch; X/Twitter later |
| File storage | Supabase Storage | chart screenshots, **private bucket** |
| Validation | Zod | shared by forms and Server Action inputs |
| Forms | react-hook-form + Zod resolver | trade entry is a large form |
| Charts | Recharts | equity curve, R-distribution, adherence overlays |
| Dates | date-fns + date-fns-tz | see §6 on timezones |
| PWA | `app/manifest.ts` + Serwist + `web-push` | per Next 16 bundled docs |
| Scheduler | Supabase `pg_cron` → Edge Function | reminders + daily FX rate fetch |
| FX rates | Frankfurter (ECB) | free, no API key, historical endpoints |
| Hosting | Vercel | native Next 16 target |

### Why Prisma alongside Supabase

They are not alternatives. Supabase is *where the database lives*; Prisma is *how the app talks to
it* and *how the schema evolves*. The data model here is genuinely relational — a trade joins to an
instrument, a journal, a set of rule checks, and a set of images, and the core metric is an
aggregate across those joins. That is where Prisma's typed relations and single schema file pay off.

Since Next 16 renders on the server anyway, nothing is lost by not querying from the browser.

---

## 3. Security architecture

The app is multi-user and open to public signup. Two rules follow, and neither is optional.

### 3.1 Row Level Security stays ON

Prisma connects directly to Postgres with a privileged connection string and **bypasses RLS
entirely**. It is tempting to conclude that RLS is therefore pointless and disable it. That would be
a critical mistake:

> Supabase exposes a public PostgREST API over every table, reachable with the `anon` key — and the
> `anon` key ships to the browser. With RLS off, any visitor can read every user's trades.

So: RLS enabled on every user-scoped table — and verified after the first migration, not assumed.

**Refinement made during Phase 0.** Supabase's automatic-RLS event trigger enables RLS on every table
Prisma creates, and we deliberately hold **zero policies**. In Postgres, RLS enabled with no policies
denies all access to any role that does not bypass it. That is the strictest possible posture, and it
is what we want: the Data API is disabled, so no legitimate caller reaches these tables through
PostgREST. Writing permissive `auth.uid()` policies would only widen access.

Policies become necessary if — and only if — the Data API is ever re-enabled, or Realtime is adopted.
At that point they are written as raw SQL inside migration files. Until then, adding them would be
loosening a working lock.

Prisma is unaffected either way: it connects as `postgres`, which carries `BYPASSRLS`. That is
precisely why §3.2 exists.

### 3.2 Prisma Client Extension as the tenancy guardrail

Do not rely on remembering to write `where: { userId }`. Instead:

- The unscoped Prisma client is **module-private**, never exported.
- The only exported accessor is `prismaForUser(userId)`, built with Prisma's `$extends` query
  extension, which auto-injects the user filter on every model carrying a `userId` and rejects
  unscoped reads/writes.
- Every Server Action resolves the Supabase session first and passes the resulting id in.

Result: a query that forgets tenancy is not merely discouraged, it is unreachable.

### 3.3 Storage

Screenshots live in a **private** bucket, keyed `{userId}/{tradeId}/{uuid}.webp`, served through
short-lived signed URLs. A public bucket would expose every user's charts to anyone who guesses a
path. Uploads go **direct from browser to Supabase Storage** using a signed upload URL minted by a
Server Action — multi-megabyte images must never transit the Next.js server.

### 3.4 Auth providers

Launch with email + Google. Add X/Twitter afterwards; its developer portal is by far the highest
friction and least stable of the providers.

**Decide identity-linking behaviour before launch.** If a user signs up with Google and later signs
in with X using the same email, Supabase's default may create a *second* account — and they will
find an empty journal with no idea why. Configure linking explicitly and test it.

---

## 4. Data model

```
User               id (= auth.users.id), email, displayName,
                   timezone, displayCurrency            ← for cross-journal totals

Journal            userId, name, broker, baseCurrency (USD|GBP|EUR|MYR),
                   startingBalance, isArchived
                   ← one per simulated trading account

Instrument         symbol, kind (FX|METAL|INDEX|CRYPTO),
                   contractSize, pipSize, quoteCurrency,
                   sizingMode (LOTS|UNITS)              ← global seeded catalogue

InstrumentOverride journalId, instrumentId, contractSize
                   ← only created when a broker's spec differs from the catalogue

Trade              userId, journalId, instrumentId,
                   direction (LONG|SHORT), size,
                   entryAt, entryPrice, stopLoss, takeProfit,
                   exitAt, exitPrice,
                   commission, swap,                     ← in journal base currency
                   pnlQuote, fxRate, pnl, pnlOverride,   ← see §5
                   rMultiple, pips, outcome (WIN|LOSS|BREAKEVEN),
                   notes

TradeImage         tradeId, storagePath, kind (BEFORE|AFTER), caption, sortOrder

Rule               userId, label, description, isActive, sortOrder
                   ← the user's personal "profitable trader" checklist

TradeRuleCheck     tradeId, ruleId, followed            ← the habit ↔ journal join

DailyReview        userId, localDate, mood, notes, disciplineScore

FxRate             base, quote, date, rate              ← daily close cache

PushSubscription   userId, endpoint, p256dh, auth, userAgent, lastSeenAt
ReminderSchedule   userId, kind, localTime, daysOfWeek, isActive
```

### Design notes

- **`outcome` is derived, never entered.** Computed from `pnl` so it can't contradict the numbers.
- **`pnl`, `rMultiple`, `pips` are computed on write and stored.** History must stay immutable even
  if an instrument spec is later corrected.
- **Planned vs actual are separate.** `stopLoss`/`takeProfit` are the *plan*; `exitPrice`/`exitAt`
  are what *happened*. Most trades don't cleanly hit either target, and the gap between plan and
  outcome is itself one of the most diagnostic habit signals available.
- **`sizingMode`** drives the UI label: "Lot size" for FX/metals/indices, "Quantity (BTC)" for
  crypto. Small detail, large clarity win.

---

## 5. The P/L and FX engine

### 5.1 One formula, four asset classes

```
pnlQuote = (exitPrice − entryPrice) × directionSign × contractSize × size
```

This holds across every instrument type provided `contractSize` is correct:

| Instrument | contractSize | quoteCurrency | 1 unit of size |
|---|---|---|---|
| EURUSD | 100,000 | USD | 1 standard lot |
| USDJPY | 100,000 | JPY | 1 standard lot |
| XAUUSD | 100 | USD | 1 lot = 100 oz |
| NAS100 | 1 | USD | 1 contract = $1/point |
| BTCUSD | 1 | USD | 1 BTC |

### 5.2 Broker-specific specs

Index and crypto contract specs vary between brokers — NAS100 is $1/point at some and $20/point at
others. Three layers of escape hatch, cheapest first:

1. **Seeded global catalogue** — correct for the common case.
2. **`InstrumentOverride`** — per journal, for a broker that differs.
3. **`pnlOverride` on the trade** — user pastes the exact figure from their statement.

The trade form shows the computed P/L live and lets the user correct it. A spec mismatch becomes a
five-second fix rather than a schema migration.

### 5.3 Currency conversion

**Rates are snapshotted at write time and never recomputed.** Converting live at read time would
mean a trade closed six months ago changes value on every page load — the equity curve would reshape
itself daily and the journal would stop being a record of what happened.

```
pnlQuote  = (exit − entry) × dirSign × contractSize × size      [quote currency]
fxRate    = FxRate(quote → journal.baseCurrency, on date(exitAt))
grossBase = pnlQuote × fxRate                                    [base currency]
pnl       = grossBase − commission − swap                        [base currency]
```

Commission and swap are charged by the broker in the account currency, so they are subtracted
*after* conversion.

- Journal base currencies: **USD, GBP, EUR, MYR**.
- Quote currencies span far more (JPY, CHF, CAD, AUD, NZD, …), so the rate table must cover
  `{any quote} → {any of the four bases}`.
- **Frankfurter** (ECB reference rates) is the provider: free, keyless, historical, covers MYR.
  Cross rates are derived via EUR.
- ECB publishes on weekdays only — **carry forward the last available rate** for weekend and holiday
  fills.
- Backdated trades look up the historical rate for their exit date, not today's.
- The daily rate fetch rides on the same cron as the reminders.

### 5.4 R-multiple

```
riskQuote = |entryPrice − stopLoss| × contractSize × size
rMultiple = pnlQuote / riskQuote
```

Both terms are in the quote currency, so **R needs no FX conversion at all**. This makes it directly
comparable across every instrument and every journal the user keeps, regardless of base currency —
which is precisely why it should be the primary metric on the dashboard.

It also requires a stop loss to be recorded at entry, which conveniently enforces the exact
discipline the app exists to build. Trades logged without a stop should be flagged, not silently
accepted.

---

## 6. Timezone handling

Streaks, "today's checklist", and daily P&L all depend on a **day boundary**. Store timestamps as
`timestamptz`, but pin `User.timezone` at signup and derive every notion of "day" from it.

Get this wrong and the streak resets at the wrong hour — which breaks the habit loop, i.e. the
entire point of the app. `DailyReview.localDate` is stored as a plain date in the user's zone, not
derived from UTC at read time.

---

## 7. Reminders and PWA

### 7.1 The core constraint

**A web app cannot schedule a local notification.** The Notification Triggers API never shipped, and
Periodic Background Sync is Chromium-only and absent on iOS. Therefore every reminder must be:

```
server cron → web-push → service worker → notification
```

This is an architectural requirement, not a detail — it means push subscriptions, user timezones,
and reminder schedules must exist in the database from the start.

### 7.2 Platform realities

| | iOS (Safari) | Android (Chrome) |
|---|---|---|
| Push support | iOS 16.4+, **only after Add to Home Screen** | works from a normal tab |
| Install prompt | none — user must tap Share → Add to Home Screen | native `beforeinstallprompt` |
| Implication | must build an instructional install nudge | straightforward |

The Next 16 docs ship an `InstallPrompt` pattern for exactly the iOS case. Subscriptions can die
silently when a user reinstalls, so `PushSubscription.lastSeenAt` is refreshed on each app open and
dead endpoints are pruned when `web-push` returns 410/404.

### 7.3 Scheduler

Supabase `pg_cron` → Edge Function, running every ~10 minutes:

1. Fetch and cache the day's FX rates (once per day).
2. Find users whose local reminder time is due and send their push.

Chosen over Vercel Cron because it is free with minute-level granularity, whereas Vercel's Hobby
tier restricts cron frequency in a way that would break sub-daily reminders.

### 7.4 Offline

Next 16 provides an experimental `useOffline` hook and matching `experimental.useOffline` config for
connectivity-aware UI and automatic retry of failed navigations and Server Actions. For real
service-worker caching, Serwist. Offline *write* support for trade entry is deferred past MVP.

---

## 8. Analytics dashboard

Aggregate in SQL on request for the MVP. Rollup tables only once it is measurably slow — this data
set is small for a long time.

**Per journal (native currency):** equity curve, cumulative P/L, win rate, average win / average
loss, profit factor, expectancy, max drawdown, R-multiple distribution.

**Behavioural cuts:** performance by instrument, by session (Asia/London/NY), by day of week, by
hour of entry, by holding duration, planned-R versus realised-R.

**The habit layer — the reason the app exists:**

- Expectancy and win rate split by *all rules followed* versus *any rule broken*.
- Per-rule impact: which specific rule costs the most when broken.
- Rule adherence trend over time, overlaid on the equity curve.
- Streaks: consecutive days journalled, consecutive fully-compliant trades.

**Cross-journal view:** totals converted into `User.displayCurrency`. Individual journal views
always stay in their own base currency — mixing them would obscure per-account performance.

---

## 9. Build phases

**Phase 0 — Foundation**
Prisma + Supabase wired up, `prismaForUser` extension, RLS policies, Supabase Auth (email +
Google), instrument catalogue seeded, deployed to Vercel. Nothing user-facing beyond login.

**Phase 1 — The journal**
Journal (account) CRUD. Trade entry form with clipboard paste, drag-drop, and file upload to private
storage. P/L + FX + R-multiple engine with live preview and override. Trade list and detail views.

**Phase 2 — The habit layer**
User-defined rules. Rule checklist embedded in the trade form. Daily review. Streaks.

**Phase 3 — Analytics**
The dashboard in §8, adherence-versus-outcome charts first — they are the product.

**Phase 4 — PWA and reminders**
Manifest, Serwist, install nudge, push subscription flow, `pg_cron` scheduler, reminder preferences.

PWA lands last because reminders need something to remind the user *about*. The manifest itself can
ship earlier at near-zero cost.

---

## 10. Open questions

- **Partial closes and scaling out.** Currently one entry and one exit per trade. Supporting partial
  exits means a `TradeExecution` child table and a weighted-average exit price. Deferred, but the
  schema should not actively block it.
- **Prop firm rules.** Journals could carry max daily loss / max drawdown limits with breach
  warnings. Natural fit for the habit theme; not MVP.
- **Instrument catalogue maintenance.** Who keeps contract specs current as brokers change them.
  Manual for now, mitigated by the override layers.
- **X/Twitter provider.** Confirm the developer portal still permits OAuth login at the intended
  tier before promising it in the UI.
- **FX for crypto quotes.** If any instrument quotes in USDT rather than USD, decide whether to
  treat it as 1:1 with USD or rate it properly. 1:1 is acceptable for a journal.
