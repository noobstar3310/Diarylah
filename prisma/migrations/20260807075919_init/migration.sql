-- CreateEnum
CREATE TYPE "AccountCurrency" AS ENUM ('USD', 'GBP', 'EUR', 'MYR');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'GBP', 'EUR', 'MYR', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'CNH', 'SEK', 'NOK', 'ZAR', 'MXN', 'PLN', 'USDT');

-- CreateEnum
CREATE TYPE "InstrumentKind" AS ENUM ('FX', 'METAL', 'INDEX', 'CRYPTO');

-- CreateEnum
CREATE TYPE "SizingMode" AS ENUM ('LOTS', 'UNITS');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "TradeOutcome" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN');

-- CreateEnum
CREATE TYPE "TradeImageKind" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('CALM', 'FOCUSED', 'ANXIOUS', 'FRUSTRATED', 'EUPHORIC', 'TIRED');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('PRE_SESSION', 'END_OF_DAY', 'UNJOURNALLED_TRADES', 'WEEKLY_REVIEW');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "displayCurrency" "AccountCurrency" NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "broker" TEXT,
    "baseCurrency" "AccountCurrency" NOT NULL,
    "startingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" "InstrumentKind" NOT NULL,
    "contractSize" DECIMAL(18,8) NOT NULL,
    "pipSize" DECIMAL(18,10),
    "quoteCurrency" "Currency" NOT NULL,
    "sizingMode" "SizingMode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrument_overrides" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "contractSize" DECIMAL(18,8) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "instrument_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "direction" "Direction" NOT NULL,
    "size" DECIMAL(18,8) NOT NULL,
    "entryAt" TIMESTAMPTZ(6) NOT NULL,
    "entryPrice" DECIMAL(24,10) NOT NULL,
    "stopLoss" DECIMAL(24,10),
    "takeProfit" DECIMAL(24,10),
    "exitAt" TIMESTAMPTZ(6),
    "exitPrice" DECIMAL(24,10),
    "commission" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "swap" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pnlQuote" DECIMAL(20,6),
    "fxRate" DECIMAL(20,10),
    "pnl" DECIMAL(18,4),
    "pnlOverride" DECIMAL(18,4),
    "rMultiple" DECIMAL(12,4),
    "pips" DECIMAL(14,2),
    "outcome" "TradeOutcome",
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_images" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "storagePath" TEXT NOT NULL,
    "kind" "TradeImageKind" NOT NULL DEFAULT 'BEFORE',
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_rule_checks" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "followed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_rule_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reviews" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "mood" "Mood",
    "notes" TEXT,
    "disciplineScore" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" UUID NOT NULL,
    "base" "AccountCurrency" NOT NULL,
    "quote" "Currency" NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "localTime" VARCHAR(5) NOT NULL,
    "daysOfWeek" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "journals_userId_isArchived_idx" ON "journals"("userId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_symbol_key" ON "instruments"("symbol");

-- CreateIndex
CREATE INDEX "instruments_kind_isActive_idx" ON "instruments"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "instrument_overrides_journalId_instrumentId_key" ON "instrument_overrides"("journalId", "instrumentId");

-- CreateIndex
CREATE INDEX "trades_userId_entryAt_idx" ON "trades"("userId", "entryAt" DESC);

-- CreateIndex
CREATE INDEX "trades_journalId_exitAt_idx" ON "trades"("journalId", "exitAt" DESC);

-- CreateIndex
CREATE INDEX "trades_journalId_instrumentId_idx" ON "trades"("journalId", "instrumentId");

-- CreateIndex
CREATE INDEX "trades_userId_outcome_idx" ON "trades"("userId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "trade_images_storagePath_key" ON "trade_images"("storagePath");

-- CreateIndex
CREATE INDEX "trade_images_tradeId_sortOrder_idx" ON "trade_images"("tradeId", "sortOrder");

-- CreateIndex
CREATE INDEX "rules_userId_isActive_sortOrder_idx" ON "rules"("userId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "trade_rule_checks_ruleId_followed_idx" ON "trade_rule_checks"("ruleId", "followed");

-- CreateIndex
CREATE UNIQUE INDEX "trade_rule_checks_tradeId_ruleId_key" ON "trade_rule_checks"("tradeId", "ruleId");

-- CreateIndex
CREATE INDEX "daily_reviews_userId_localDate_idx" ON "daily_reviews"("userId", "localDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_reviews_userId_localDate_key" ON "daily_reviews"("userId", "localDate");

-- CreateIndex
CREATE INDEX "fx_rates_base_quote_date_idx" ON "fx_rates"("base", "quote", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_base_quote_date_key" ON "fx_rates"("base", "quote", "date");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "reminder_schedules_isActive_localTime_idx" ON "reminder_schedules"("isActive", "localTime");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_userId_kind_key" ON "reminder_schedules"("userId", "kind");

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_overrides" ADD CONSTRAINT "instrument_overrides_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_overrides" ADD CONSTRAINT "instrument_overrides_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_images" ADD CONSTRAINT "trade_images_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_rule_checks" ADD CONSTRAINT "trade_rule_checks_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_rule_checks" ADD CONSTRAINT "trade_rule_checks_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reviews" ADD CONSTRAINT "daily_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
