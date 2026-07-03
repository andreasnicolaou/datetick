// Shared public + internal type declarations for DateTick.
import type { DateTick } from './datetick';

export type DateUnit =
  'millisecond' | 'second' | 'minute' | 'hour' | 'date' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type DateFormatPreset =
  'short' | 'medium' | 'long' | 'full' | 'dateOnly' | 'timeOnly' | 'weekdayTime' | 'isoStyle12h' | 'isoStyle24h';

export type DateGettableUnit =
  | DateUnit
  | 'dayOfYear'
  | 'isoDay'
  | 'isoWeek'
  | 'isoWeekYear'
  | 'isoWeeksInYear'
  | 'weekYear'
  | 'weekday'
  | 'weeksInYear'
  | 'daysInMonth';

export type CalendarDiffUnit = 'date' | 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Per-side bound inclusivity for {@link DateTick.isBetween}: `(` / `)` are exclusive, `[` / `]` are inclusive.
 * For example `'[)'` includes the start bound but excludes the end bound.
 */
export type Inclusivity = '()' | '[]' | '(]' | '[)';

export type DateArray = [
  year: number,
  month: number,
  date: number,
  hour?: number,
  minute?: number,
  second?: number,
  millisecond?: number,
];

export interface DateObject {
  year: number;
  month: number;
  date: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

export interface DatePartsObject extends Required<DateObject> {
  day: number;
}

/**
 * Anything that can be resolved to a point in time: a native Date, an ISO/parsable string,
 * a Unix timestamp in milliseconds, or another DateTick instance.
 */
export type DateInput = Date | string | number | DateTick | DateObject | DateArray;

/**
 * A localized weekday label for a calendar grid header.
 */
export interface CalendarWeekday {
  day: number; // 0 (Sun) - 6 (Sat)
  isoDay: number; // 1 (Mon) - 7 (Sun)
  long: string;
  short: string;
  narrow: string;
}

/**
 * A single date cell in a calendar month grid.
 */
export interface CalendarDate {
  value: DateTick;
  isoDate: string;
  formatted: string;
  year: number;
  month: number; // 0-11
  date: number; // 1-31
  day: number; // 0 (Sun) - 6 (Sat)
  isoDay: number; // 1 (Mon) - 7 (Sun)
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

/**
 * Options for calendar month generation.
 */
export interface CalendarMonthOptions {
  selected?: DateInput | false;
  dateFormat?: string | Intl.DateTimeFormatOptions | ((date: DateTick) => string);
}

/**
 * Token patterns used by {@link DateTick.calendar} for calendar-style relative labels.
 */
export interface CalendarDisplayFormats {
  sameDay?: string | ((date: DateTick) => string);
  nextDay?: string | ((date: DateTick) => string);
  nextWeek?: string | ((date: DateTick) => string);
  lastDay?: string | ((date: DateTick) => string);
  lastWeek?: string | ((date: DateTick) => string);
  sameElse?: string | ((date: DateTick) => string);
}

/**
 * Calendar data for rendering a month view.
 */
export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  label: string;
  weekdays: CalendarWeekday[];
  days: CalendarDate[];
  weeks: CalendarDate[][];
}

/**
 * A bag of calendar components used to construct a Duration.
 */
export interface DurationInput {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

/**
 * Produces the ordinal form of a number (e.g. `1` -> `'1st'` in English, `'1er'` in French). Supplied
 * via the factory to localize `ordinal()` and the `Do`/`wo`/`Wo` tokens, which are English by default.
 */
export type OrdinalFn = (n: number) => string;

/**
 * Locale metadata for a {@link DateTick}, resolved through `Intl` — the Day.js `localeData()` equivalent.
 */
export interface LocaleData {
  /** Long month names, index 0 = January. */
  months(): string[];
  /** Short month names, index 0 = January. */
  monthsShort(): string[];
  /** Long weekday names, index 0 = Sunday. */
  weekdays(): string[];
  /** Short weekday names, index 0 = Sunday. */
  weekdaysShort(): string[];
  /** Narrow (minimal) weekday names, index 0 = Sunday. */
  weekdaysMin(): string[];
  /** The configured first day of the week (0 = Sunday … 6 = Saturday). */
  firstDayOfWeek(): number;
  /** The locale's AM/PM markers. */
  meridiems(): { am: string; pm: string };
  /** The AM or PM marker for a 0-23 hour (lowercased when `isLowercase`). */
  meridiem(hour: number, isLowercase?: boolean): string;
  /** The ordinal form of a number (e.g. `1` -> `'1st'`). */
  ordinal(n: number): string;
}

/**
 * Overrides the cutoffs {@link DateTick.timeAgo} uses to step up from one unit to the next. Each value is
 * the largest count of that unit still shown before switching to the next larger unit (e.g. `second: 60`
 * shows seconds up to 59, then minutes). Months use a 30-day approximation and years a 365-day one.
 */
export interface RelativeTimeThresholds {
  /** Max seconds before switching to minutes (default 60). */
  second?: number;
  /** Max minutes before switching to hours (default 60). */
  minute?: number;
  /** Max hours before switching to days (default 24). */
  hour?: number;
  /** Max days before switching to months (default 30). */
  day?: number;
  /** Max months before switching to years (default 12). */
  month?: number;
}

/**
 * Receives live relative-time labels from {@link DateTick.timeAgoLive}.
 */
export type TimeAgoListener = (value: string) => void;

/**
 * A dependency-free live relative-time subscription.
 */
export interface TimeAgoLive {
  subscribe(listener: TimeAgoListener): () => void;
  unsubscribe(): void;
}

/**
 * The wall-clock components of an instant as seen in a specific timezone.
 *
 * @internal
 */
export interface ZonedParts {
  year: number;
  month: number; // 0-11
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  millisecond: number;
  weekday: number; // 0 (Sun) - 6 (Sat)
}
