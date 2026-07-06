import { DateTick } from './datetick';
import { Duration } from './duration';
import type { DateInput, DateUnit, DurationInput, OrdinalFn } from './types';

export { DateTick } from './datetick';
export { Duration } from './duration';
export type {
  CalendarDiffUnit,
  CalendarDate,
  CalendarMonth,
  CalendarMonthOptions,
  CalendarWeekday,
  DateArray,
  CalendarDisplayFormats,
  DateFormatPreset,
  DateGettableUnit,
  DateInput,
  DateObject,
  DatePartsObject,
  DateUnit,
  DurationInput,
  Inclusivity,
  LocaleData,
  OrdinalFn,
  RelativeTimeThresholds,
  TimeAgoListener,
  TimeAgoLive,
} from './types';

/**
 * Options accepted by the {@link datetick} factory and {@link DateTickFactory.withDefaults}.
 */
export interface DateTickOptions {
  /** BCP 47 locale used for formatting (default 'en'). */
  locale?: string;
  /** IANA timezone all calendar operations resolve through (default: the runtime timezone). */
  timezone?: string;
  /** First day of the week, 0 = Sunday … 6 = Saturday (default 0). */
  weekStartsOn?: number;
  /** Overrides the English ordinal used by `ordinal()` and the `Do`/`wo`/`Wo` tokens. */
  ordinal?: OrdinalFn;
}

/**
 * The callable factory plus its attached static helpers.
 */
export interface DateTickFactory {
  /**
   * Creates a {@link DateTick} from a date input.
   *
   * @param date - A Date, ISO/parsable string, DateTick, date parts object, or date parts array (defaults to now)
   * @param options - locale / timezone / weekStartsOn overrides (merged over this factory's defaults)
   */
  (date?: DateInput, options?: DateTickOptions): DateTick;
  /** Creates a {@link Duration}, using this factory's default locale unless overridden. */
  duration(value: number | string | DurationInput, unit?: DateUnit, locale?: string): Duration;
  /** See {@link DateTick.each}. Each result inherits this factory's locale/timezone/week-start defaults. */
  each(start: DateInput, end: DateInput, unit?: DateUnit, step?: number): DateTick[];
  /** See {@link DateTick.guessTimezone}. */
  guessTimezone: typeof DateTick.guessTimezone;
  /** Parses a string into a DateTick, using this factory's default locale/timezone unless overridden. */
  parse(input: string, pattern: string, locale?: string, timezone?: string): DateTick;
  /** See {@link DateTick.min}. */
  min: typeof DateTick.min;
  /** See {@link DateTick.max}. */
  max: typeof DateTick.max;
  /** See {@link DateTick.isValid}. */
  isValid: typeof DateTick.isValid;
  /** See {@link DateTick.isDateTick}. */
  isDateTick: typeof DateTick.isDateTick;
  /** See {@link Duration.isDuration}. */
  isDuration: typeof Duration.isDuration;
  /** Shorthand for `datetick(date, { ...options, timezone: 'UTC' })`. */
  utc(date?: DateInput, options?: Omit<DateTickOptions, 'timezone'>): DateTick;
  /** Creates a DateTick from a Unix timestamp in seconds. */
  unix(seconds: number, options?: DateTickOptions): DateTick;
  /**
   * Returns a new, independent factory pre-bound to the given defaults, merged over this
   * factory's own defaults. Does not mutate this factory or any global state — every part of
   * an app that wants the same defaults imports the same scoped factory instance.
   *
   * @example
   * const frDateTick = datetick.withDefaults({ locale: 'fr', timezone: 'Europe/Paris' });
   * frDateTick('2026-06-25').format('long'); // French, Paris
   * datetick('2026-06-25').format('long'); // unaffected, still 'en' / runtime timezone
   */
  withDefaults(defaults: DateTickOptions): DateTickFactory;
}

const createDateTickFactory = (defaults: DateTickOptions): DateTickFactory => {
  const factory = (date?: DateInput, options: DateTickOptions = {}): DateTick => {
    const merged = { ...defaults, ...options };
    const input = date instanceof DateTick ? date.toDate() : date;
    return new DateTick(merged.locale ?? 'en', merged.timezone, input, merged.weekStartsOn ?? 0, merged.ordinal);
  };

  return Object.assign(factory, {
    duration: (
      value: number | string | DurationInput,
      unit?: DateUnit,
      locale: string = defaults.locale ?? 'en'
    ): Duration => DateTick.duration(value, unit, locale),
    each: (start: DateInput, end: DateInput, unit: DateUnit = 'day', step: number = 1): DateTick[] =>
      DateTick.each(factory(start), end, unit, step),
    guessTimezone: DateTick.guessTimezone,
    parse: (
      input: string,
      pattern: string,
      locale: string = defaults.locale ?? 'en',
      timezone: string = defaults.timezone ?? DateTick.guessTimezone()
    ): DateTick => DateTick.parse(input, pattern, locale, timezone),
    min: DateTick.min,
    max: DateTick.max,
    isValid: DateTick.isValid,
    isDateTick: DateTick.isDateTick,
    isDuration: Duration.isDuration,
    utc: (date?: DateInput, options: Omit<DateTickOptions, 'timezone'> = {}): DateTick =>
      factory(date, { ...options, timezone: 'UTC' }),
    unix: (seconds: number, options: DateTickOptions = {}): DateTick => factory(new Date(seconds * 1000), options),
    withDefaults: (next: DateTickOptions): DateTickFactory => createDateTickFactory({ ...defaults, ...next }),
  });
};

/**
 * The quickest way to create a {@link DateTick}.
 *
 * @example
 * datetick('2026-06-25T19:23Z', { timezone: 'Asia/Tokyo' }).formatPattern('DD/MM/YYYY HH:mm');
 * datetick.duration(90, 'minute').humanize(); // '2 hours'
 * datetick.utc('2026-06-25').startOf('week');
 */
// The PURE annotation tells bundlers this call has no observable side effects, so consumers
// that only import `DateTick` or `Duration` (not `datetick`/the default export) can tree-shake this away.
export const datetick: DateTickFactory = /* @__PURE__ */ createDateTickFactory({});

export default datetick;
