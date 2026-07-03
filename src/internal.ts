// Pure, framework-agnostic helpers shared by DateTick. These deliberately have no class state:
// timezone resolution, wall-clock <-> instant conversion, and token-pattern tooling all live here.
import type { ZonedParts } from './types';

/**
 * Returns the number of days in a given month (month is 0-based).
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
};

/**
 * Reads the wall-clock components of an instant as seen in a given timezone.
 */
export const partsOf = (date: Date, timezone: string): ZonedParts => {
  // Guard invalid dates: `Intl.DateTimeFormat` throws a RangeError on an invalid Date, which would
  // otherwise make every getter (`year()`, `month()`, …) throw instead of surfacing NaN.
  if (Number.isNaN(date.getTime())) {
    return {
      year: Number.NaN,
      month: Number.NaN,
      day: Number.NaN,
      hour: Number.NaN,
      minute: Number.NaN,
      second: Number.NaN,
      millisecond: Number.NaN,
      weekday: Number.NaN,
    };
  }
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = Number(part.value);
  }
  // Day-of-week is derived from the zoned Y/M/D treated as a UTC date (a stable, locale-free lookup).
  const weekday = new Date(Date.UTC(map.year, map.month - 1, map.day)).getUTCDay();
  return {
    year: map.year,
    month: map.month - 1,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
    millisecond: date.getMilliseconds(),
    weekday,
  };
};

/**
 * The timezone's offset from UTC (in ms) at a given instant (positive when ahead of UTC).
 */
export const offsetMs = (instant: Date, timezone: string): number => {
  const p = partsOf(instant, timezone);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second, p.millisecond);
  return asUtc - instant.getTime();
};

/**
 * Converts wall-clock components in a timezone back to an absolute instant.
 * Runs a two-pass correction so it stays correct across DST transitions.
 */
export const instantFromParts = (
  parts: Pick<ZonedParts, 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'>,
  timezone: string
): Date => {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );
  const offset1 = offsetMs(new Date(utcGuess), timezone);
  let instant = utcGuess - offset1;
  const offset2 = offsetMs(new Date(instant), timezone);
  if (offset2 !== offset1) instant = utcGuess - offset2;
  return new Date(instant);
};

// Localized month/weekday names are stable per (locale, style); creating a fresh `Intl.DateTimeFormat`
// on every call is costly, so resolved names are memoized (e.g. when rendering a calendar grid).
const monthNamesCache = new Map<string, string[]>();
const weekdayNamesCache = new Map<string, string[]>();

/**
 * Returns the localized month names for a locale (index 0 = January).
 */
export const localeMonthNames = (locale: string, style: 'long' | 'short'): string[] => {
  const key = `${locale} ${style}`;
  let names = monthNamesCache.get(key);
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' });
    names = Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2021, i, 15))));
    monthNamesCache.set(key, names);
  }
  return names;
};

/**
 * Returns the localized weekday names for a locale, Sunday-first (index 0 = Sunday).
 */
export const localeWeekdayNames = (locale: string, style: 'long' | 'short' | 'narrow'): string[] => {
  const key = `${locale} ${style}`;
  let names = weekdayNamesCache.get(key);
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' });
    // 2020-06-07 is a Sunday, so +i walks Sunday..Saturday.
    names = Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2020, 5, 7 + i))));
    weekdayNamesCache.set(key, names);
  }
  return names;
};

const meridiemCache = new Map<string, { am: string; pm: string }>();

/**
 * Returns a locale's AM/PM markers (e.g. en -> `{ am: 'AM', pm: 'PM' }`, zh -> morning/afternoon
 * ideographs), falling back to English when a locale exposes none.
 */
export const localeMeridiems = (locale: string): { am: string; pm: string } => {
  const cached = meridiemCache.get(locale);
  if (cached) return cached;
  const dtf = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const at = (hour: number): string =>
    dtf.formatToParts(new Date(Date.UTC(2020, 0, 1, hour))).find((p) => p.type === 'dayPeriod')?.value ?? '';
  const markers = { am: at(6) || 'AM', pm: at(18) || 'PM' };
  meridiemCache.set(locale, markers);
  return markers;
};

/**
 * Builds a case-insensitive regex alternation matching a locale's AM/PM markers, for use when parsing
 * the `A`/`a` token (e.g. `PM|pm|AM|am`).
 */
export const meridiemRegexGroup = (locale: string): string => {
  const { am, pm } = localeMeridiems(locale);
  const variants = (s: string): string[] => [s.toLocaleUpperCase(locale), s.toLocaleLowerCase(locale)];
  return Array.from(new Set([...variants(pm), ...variants(am)]))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
};

/**
 * Returns the English ordinal suffix ('st', 'nd', 'rd', 'th') for a number.
 */
export const ordinalSuffix = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

type LocalizedToken = 'LTS' | 'LT' | 'LLLL' | 'LLL' | 'LL' | 'L' | 'llll' | 'lll' | 'll' | 'l';

// dayjs-style localized tokens, described as the (date-part, time-part) Intl option pair each one
// derives from. Date and time are requested as separate `Intl` calls and joined with a space so that
// modern ICU never injects an " at " connector between them.
const TIME_LT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const TIME_LTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit' };
const LOCALIZED_PARTS: Record<
  LocalizedToken,
  { date?: Intl.DateTimeFormatOptions; time?: Intl.DateTimeFormatOptions }
> = {
  LT: { time: TIME_LT },
  LTS: { time: TIME_LTS },
  L: { date: { year: 'numeric', month: '2-digit', day: '2-digit' } },
  l: { date: { year: 'numeric', month: 'numeric', day: 'numeric' } },
  LL: { date: { year: 'numeric', month: 'long', day: 'numeric' } },
  ll: { date: { year: 'numeric', month: 'short', day: 'numeric' } },
  LLL: { date: { year: 'numeric', month: 'long', day: 'numeric' }, time: TIME_LT },
  lll: { date: { year: 'numeric', month: 'short', day: 'numeric' }, time: TIME_LT },
  LLLL: { date: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, time: TIME_LT },
  llll: { date: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }, time: TIME_LT },
};

// Derived localized patterns are cached per (locale, token): `formatToParts` is comparatively costly.
const localizedCache = new Map<string, string[]>();

// Base token for each field, keyed by the `Intl` option value requested for it. Picks the token whose
// width matches the option so a round-trip through `formatPattern`/`parse` stays faithful.
const MONTH_TOKENS: Record<string, string> = { numeric: 'M', '2-digit': 'MM', short: 'MMM', long: 'MMMM' };
const WEEKDAY_TOKENS: Record<string, string> = { narrow: 'dd', short: 'ddd', long: 'dddd' };

// Resolves a single `Intl` part into a base token; missing entries are separators/literals.
const PART_TOKEN: Partial<
  Record<Intl.DateTimeFormatPartTypes, (o: Intl.DateTimeFormatOptions, hour12: boolean) => string>
> = {
  year: (o) => (o.year === '2-digit' ? 'YY' : 'YYYY'),
  month: (o) => MONTH_TOKENS[o.month ?? 'numeric'] ?? 'MMMM',
  day: (o) => (o.day === '2-digit' ? 'DD' : 'D'),
  weekday: (o) => WEEKDAY_TOKENS[o.weekday ?? 'long'] ?? 'dddd',
  hour: (_o, hour12) => (hour12 ? 'h' : 'HH'),
  minute: () => 'mm',
  second: () => 'ss',
  dayPeriod: () => 'A',
};

/**
 * Translates one `Intl` skeleton into DateTick base tokens for the given locale, preserving that locale's
 * field order and separators. Separators come back as `[escaped]` literals (with exotic spaces
 * normalized), while each field maps to the base token whose width matches the requested option, so
 * the surrounding `formatPattern`/`parse` still resolves values through the configured timezone.
 */
const tokensFromIntl = (locale: string, options: Intl.DateTimeFormatOptions): string[] => {
  const dtf = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
  const hour12 = dtf.resolvedOptions().hour12 ?? false;
  // A reference instant with every field distinct (Thursday, 2 Jan 2020 03:04:05); only part *types*
  // are read, so the concrete values never leak into the produced pattern.
  const ref = new Date(Date.UTC(2020, 0, 2, 3, 4, 5));
  return dtf.formatToParts(ref).map((part) => {
    const resolve = PART_TOKEN[part.type];
    // Normalize no-break / narrow-no-break spaces so output stays stable across ICU versions.
    return resolve ? resolve(options, hour12) : `[${part.value.replace(/[\u00a0\u202f]/g, ' ')}]`;
  });
};

/**
 * Expands a localized token (`L`/`LL`/`LT`/etc.) into locale-aware base tokens.
 */
const localizedTokens = (token: LocalizedToken, locale: string): string[] => {
  const key = `${locale} ${token}`;
  const cached = localizedCache.get(key);
  if (cached) return cached;
  const spec = LOCALIZED_PARTS[token];
  const tokens: string[] = [];
  if (spec.date) tokens.push(...tokensFromIntl(locale, spec.date));
  if (spec.date && spec.time) tokens.push('[ ]');
  if (spec.time) tokens.push(...tokensFromIntl(locale, spec.time));
  localizedCache.set(key, tokens);
  return tokens;
};

// Fallback base-token patterns for localized tokens when no locale is supplied (US-English layout).
const LOCALIZED_FALLBACK: Record<string, string> = {
  LTS: 'h:mm:ss A',
  LT: 'h:mm A',
  LLLL: 'dddd, MMMM D, YYYY h:mm A',
  LLL: 'MMMM D, YYYY h:mm A',
  LL: 'MMMM D, YYYY',
  L: 'MM/DD/YYYY',
  llll: 'ddd, MMM D, YYYY h:mm A',
  lll: 'MMM D, YYYY h:mm A',
  ll: 'MMM D, YYYY',
  l: 'M/D/YYYY',
};

// Recognized tokens, ordered by descending length so the matcher is greedy (e.g. `LLLL` before `LL`).
const TOKENS = [
  'YYYY',
  'MMMM',
  'dddd',
  'LLLL',
  'llll',
  'MMM',
  'ddd',
  'SSS',
  'LLL',
  'LTS',
  'lll',
  'YY',
  'MM',
  'DD',
  'dd',
  'HH',
  'hh',
  'mm',
  'ss',
  'ZZ',
  'Do',
  'kk',
  'ww',
  'wo',
  'WW',
  'Wo',
  'LL',
  'LT',
  'll',
  'M',
  'D',
  'd',
  'H',
  'h',
  'm',
  's',
  'A',
  'a',
  'Z',
  'Q',
  'k',
  'X',
  'x',
  'w',
  'W',
  'L',
  'l',
];

// Expands a matched token: localized tokens resolve to locale-aware base tokens (or the US fallback
// when no locale is given); everything else passes through unchanged.
const expandToken = (token: string, locale?: string): string[] => {
  if (!(token in LOCALIZED_FALLBACK)) return [token];
  if (locale) return localizedTokens(token as LocalizedToken, locale);
  return splitTokens(LOCALIZED_FALLBACK[token]);
};

/**
 * Greedy pattern tokenizer shared by date and duration formatting. Splits a pattern into an ordered
 * list of recognized tokens (matched longest-first from `tokens`), `[escaped]` literals (brackets
 * retained), and single passthrough characters. An unclosed `[` is emitted as a literal character.
 */
export const tokenize = (pattern: string, tokens: readonly string[]): string[] => {
  const out: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    const end = pattern[i] === '[' ? pattern.indexOf(']', i) : -1;
    if (end !== -1) {
      out.push(pattern.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    const matched = tokens.find((t) => pattern.startsWith(t, i));
    if (matched) {
      out.push(matched);
      i += matched.length;
    } else {
      out.push(pattern[i]);
      i += 1;
    }
  }
  return out;
};

/**
 * Splits a token pattern into an ordered list of tokens, literal characters and `[escaped]` literals.
 * Longer tokens are matched before their prefixes (e.g. `MMMM` before `MM`), and localized tokens
 * (`L`/`LL`/`LT`/etc.) are expanded in place into their underlying base tokens. When a `locale` is
 * given, localized tokens follow that locale's field order and separators; otherwise they fall back to
 * the US-English layout. Literals and non-localized tokens pass through `expandToken` unchanged.
 */
export const splitTokens = (pattern: string, locale?: string): string[] => {
  return tokenize(pattern, TOKENS).flatMap((segment) => expandToken(segment, locale));
};
