/**
 * The shared instrument catalogue.
 *
 * `contractSize` is the multiplier in the P/L formula (docs/PLAN.md §5.1):
 *
 *   pnlQuote = (exitPrice - entryPrice) x direction x contractSize x size
 *
 * These are the common retail defaults. **Index and crypto specs vary between
 * brokers** — NAS100 is $1/point at some and $20/point at others — so a trader
 * whose broker differs sets an InstrumentOverride on their journal, or corrects
 * the figure on the trade itself. See docs/PLAN.md §5.2.
 *
 * `pipSize` is display-only, for showing "+45 pips". Null where pips are not a
 * meaningful unit.
 */

// Typed against the generated enums rather than string literals, so a mistyped
// symbol currency or a currency missing from schema.prisma fails to compile
// instead of failing at insert time.
import type {
  Currency,
  InstrumentKind,
  SizingMode,
} from '../lib/generated/prisma/enums'

type Seed = {
  symbol: string
  displayName: string
  kind: InstrumentKind
  contractSize: string
  pipSize: string | null
  quoteCurrency: Currency
  sizingMode: SizingMode
}

/** 1 standard lot = 100,000 units of the base currency. */
const fx = (symbol: string, displayName: string, quoteCurrency: Currency): Seed => ({
  symbol,
  displayName,
  kind: 'FX',
  contractSize: '100000',
  // JPY pairs quote to 3 decimals with a 0.01 pip; everything else uses 0.0001.
  pipSize: quoteCurrency === 'JPY' ? '0.01' : '0.0001',
  quoteCurrency,
  sizingMode: 'LOTS',
})

/** Index CFDs are priced per point, so one contract moves 1 unit per point. */
const index = (symbol: string, displayName: string, quoteCurrency: Currency): Seed => ({
  symbol,
  displayName,
  kind: 'INDEX',
  contractSize: '1',
  pipSize: null,
  quoteCurrency,
  sizingMode: 'LOTS',
})

/** Sized in coin units rather than lots, so the multiplier is 1. */
const crypto = (symbol: string, displayName: string): Seed => ({
  symbol,
  displayName,
  kind: 'CRYPTO',
  contractSize: '1',
  pipSize: null,
  quoteCurrency: 'USD',
  sizingMode: 'UNITS',
})

export const INSTRUMENTS: Seed[] = [
  // --- FX majors ----------------------------------------------------------
  fx('EURUSD', 'Euro / US Dollar', 'USD'),
  fx('GBPUSD', 'British Pound / US Dollar', 'USD'),
  fx('USDJPY', 'US Dollar / Japanese Yen', 'JPY'),
  fx('USDCHF', 'US Dollar / Swiss Franc', 'CHF'),
  fx('USDCAD', 'US Dollar / Canadian Dollar', 'CAD'),
  fx('AUDUSD', 'Australian Dollar / US Dollar', 'USD'),
  fx('NZDUSD', 'New Zealand Dollar / US Dollar', 'USD'),

  // --- FX crosses ---------------------------------------------------------
  fx('EURGBP', 'Euro / British Pound', 'GBP'),
  fx('EURJPY', 'Euro / Japanese Yen', 'JPY'),
  fx('EURCHF', 'Euro / Swiss Franc', 'CHF'),
  fx('EURAUD', 'Euro / Australian Dollar', 'AUD'),
  fx('EURCAD', 'Euro / Canadian Dollar', 'CAD'),
  fx('EURNZD', 'Euro / New Zealand Dollar', 'NZD'),
  fx('GBPJPY', 'British Pound / Japanese Yen', 'JPY'),
  fx('GBPCHF', 'British Pound / Swiss Franc', 'CHF'),
  fx('GBPAUD', 'British Pound / Australian Dollar', 'AUD'),
  fx('GBPCAD', 'British Pound / Canadian Dollar', 'CAD'),
  fx('GBPNZD', 'British Pound / New Zealand Dollar', 'NZD'),
  fx('AUDJPY', 'Australian Dollar / Japanese Yen', 'JPY'),
  fx('AUDCAD', 'Australian Dollar / Canadian Dollar', 'CAD'),
  fx('AUDCHF', 'Australian Dollar / Swiss Franc', 'CHF'),
  fx('AUDNZD', 'Australian Dollar / New Zealand Dollar', 'NZD'),
  fx('NZDJPY', 'New Zealand Dollar / Japanese Yen', 'JPY'),
  fx('NZDCAD', 'New Zealand Dollar / Canadian Dollar', 'CAD'),
  fx('CADJPY', 'Canadian Dollar / Japanese Yen', 'JPY'),
  fx('CADCHF', 'Canadian Dollar / Swiss Franc', 'CHF'),
  fx('CHFJPY', 'Swiss Franc / Japanese Yen', 'JPY'),

  // --- FX exotics ---------------------------------------------------------
  fx('USDSGD', 'US Dollar / Singapore Dollar', 'SGD'),
  fx('USDHKD', 'US Dollar / Hong Kong Dollar', 'HKD'),
  fx('USDCNH', 'US Dollar / Offshore Chinese Yuan', 'CNH'),
  fx('USDSEK', 'US Dollar / Swedish Krona', 'SEK'),
  fx('USDNOK', 'US Dollar / Norwegian Krone', 'NOK'),
  fx('USDMXN', 'US Dollar / Mexican Peso', 'MXN'),
  fx('USDZAR', 'US Dollar / South African Rand', 'ZAR'),
  fx('USDPLN', 'US Dollar / Polish Zloty', 'PLN'),

  // --- Metals -------------------------------------------------------------
  // Gold: 1 lot = 100 troy ounces, not 100,000 units. Getting this wrong is the
  // single most common P/L miscalculation in retail journals.
  {
    symbol: 'XAUUSD',
    displayName: 'Gold / US Dollar',
    kind: 'METAL',
    contractSize: '100',
    pipSize: '0.01',
    quoteCurrency: 'USD',
    sizingMode: 'LOTS',
  },
  // Silver: 1 lot = 5,000 troy ounces.
  {
    symbol: 'XAGUSD',
    displayName: 'Silver / US Dollar',
    kind: 'METAL',
    contractSize: '5000',
    pipSize: '0.001',
    quoteCurrency: 'USD',
    sizingMode: 'LOTS',
  },

  // --- Indices ------------------------------------------------------------
  index('NAS100', 'US Tech 100', 'USD'),
  index('US30', 'US Wall Street 30', 'USD'),
  index('SPX500', 'US 500', 'USD'),
  index('US2000', 'US Small Cap 2000', 'USD'),
  index('GER40', 'Germany 40', 'EUR'),
  index('UK100', 'UK 100', 'GBP'),
  index('FRA40', 'France 40', 'EUR'),
  index('JPN225', 'Japan 225', 'JPY'),
  index('HK50', 'Hong Kong 50', 'HKD'),
  index('AUS200', 'Australia 200', 'AUD'),

  // --- Crypto -------------------------------------------------------------
  crypto('BTCUSD', 'Bitcoin / US Dollar'),
  crypto('ETHUSD', 'Ethereum / US Dollar'),
  crypto('SOLUSD', 'Solana / US Dollar'),
  crypto('XRPUSD', 'XRP / US Dollar'),
  crypto('BNBUSD', 'BNB / US Dollar'),
  crypto('ADAUSD', 'Cardano / US Dollar'),
  crypto('DOGEUSD', 'Dogecoin / US Dollar'),
  crypto('LTCUSD', 'Litecoin / US Dollar'),
]
