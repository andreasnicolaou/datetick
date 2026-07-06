import type {
  CalendarDisplayFormats,
  CalendarDate,
  CalendarDiffUnit,
  CalendarMonth,
  CalendarMonthOptions,
  CalendarWeekday,
  DateArray,
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
  ZonedParts,
} from './types';
import {
  getDaysInMonth,
  instantFromParts,
  localeMeridiems,
  localeMonthNames,
  localeWeekdayNames,
  meridiemRegexGroup,
  offsetMs,
  ordinalSuffix,
  partsOf,
  splitTokens,
  utcDateFromYMD,
  utcFromParts,
} from './internal';
import { Duration } from './duration';

/**
 * Framework-agnostic, fully timezone-aware date utility class.
 *
 * Instances are immutable: every getter/setter-style method returns a brand new
 * `DateTick` rather than mutating the current one, so it is safe to share instances
 * across Angular components, React renders, Vue computed properties, or plain scripts.
 *
 * Every calendar operation — reading components, setting them, `add`/`subtract`,
 * `startOf`/`endOf`, week/quarter math and formatting — is resolved through the configured
 * IANA `timezone`, so a single absolute instant is consistently interpreted in one zone.
 *
 * @class DateTick
 * @author Andreas Nicolaou <anicolaou66@gmail.com>
 */
export class DateTick {
  private readonly _date: Date;
  private readonly _locale: string;
  private readonly _ordinal?: OrdinalFn;
  private readonly _timezone: string;
  private readonly _weekStartsOn: number;

  /**
   * Creates a new DateTick instance.
   *
   * @param {string} [locale='en'] - The BCP 47 locale used for formatting
   * @param {string} [timezone] - The IANA timezone all calendar operations resolve through (defaults to the runtime's timezone)
   * @param {DateInput} [date] - The wrapped instant or zoned wall-clock parts (defaults to now). Date instances are cloned defensively.
   * @param {number} [weekStartsOn=0] - First day of the week (0 = Sunday … 6 = Saturday), used by `week()` and `startOf`/`endOf('week')`
   * @param {OrdinalFn} [ordinal] - Overrides the English ordinal used by `ordinal()` and the `Do`/`wo`/`Wo` tokens
   * @memberof DateTick
   */
  constructor(
    locale: string = 'en',
    timezone: string = DateTick.guessTimezone(),
    date?: DateInput,
    weekStartsOn: number = 0,
    ordinal?: OrdinalFn
  ) {
    this._locale = locale;
    this._timezone = timezone;
    this._weekStartsOn = ((weekStartsOn % 7) + 7) % 7;
    this._ordinal = ordinal;
    if (date == null) {
      this._date = new Date();
    } else {
      this._date = DateTick.resolveInput(date, timezone);
    }
  }

  /**
   * Creates a {@link Duration} representing a length of time.
   *
   * @param {number | string | DurationInput} value - A millisecond amount, an amount paired with `unit`,
   * an ISO 8601 duration string (e.g. 'P1Y2M10DT2H30M'), or a components object
   * @param {DateUnit} [unit] - The unit when `value` is a number (defaults to milliseconds)
   * @param {string} [locale='en'] - The locale used by `humanize()`
   * @returns {Duration} The duration
   * @example DateTick.duration(2, 'hour').humanize() // '2 hours'
   * @memberof DateTick
   */
  public static duration(value: number | string | DurationInput, unit?: DateUnit, locale: string = 'en'): Duration {
    return new Duration(value, unit, locale);
  }

  /**
   * Returns the runtime's best-guess IANA timezone.
   *
   * @returns {string} The guessed IANA timezone
   * @memberof DateTick
   */
  public static guessTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Checks whether a value is a DateTick instance.
   *
   * @param {unknown} value - The value to check
   * @returns {boolean} True if the value is a DateTick
   * @memberof DateTick
   */
  public static isDateTick(value: unknown): value is DateTick {
    return value instanceof DateTick;
  }

  /**
   * Checks if a date value is valid
   *
   * @param {DateInput} date - The date to validate
   * @returns {boolean} True if valid, false otherwise
   * @memberof DateTick
   */
  public static isValid(date: DateInput): boolean {
    const d = DateTick.resolveInput(date);
    return !Number.isNaN(d.getTime());
  }

  /**
   * Returns the maximum (latest) date from a list
   *
   * @param {...DateInput[]} dates - Dates to compare
   * @returns {Date} The latest date
   * @memberof DateTick
   */
  public static max(...dates: DateInput[]): Date {
    const maxTime = Math.max(...dates.map((d) => DateTick.resolveInput(d).getTime()));
    return new Date(maxTime);
  }

  /**
   * Returns the minimum (earliest) date from a list
   *
   * @param {...DateInput[]} dates - Dates to compare
   * @returns {Date} The earliest date
   * @memberof DateTick
   */
  public static min(...dates: DateInput[]): Date {
    const minTime = Math.min(...dates.map((d) => DateTick.resolveInput(d).getTime()));
    return new Date(minTime);
  }

  /**
   * Parses a string into a DateTick using an explicit token pattern, interpreting the wall-clock
   * values in the given timezone. Supported tokens mirror {@link DateTick.formatPattern}; anything
   * else (and text wrapped in `[square brackets]`) is treated as a literal. A parsed offset token
   * (`Z`/`ZZ`) fixes the absolute instant directly, overriding the `timezone` argument.
   *
   * @param {string} input - The string to parse (e.g. '25/06/2026 22:23')
   * @param {string} pattern - The token pattern (e.g. 'DD/MM/YYYY HH:mm')
   * @param {string} [locale='en'] - The BCP 47 locale (also used to resolve month names)
   * @param {string} [timezone] - The IANA timezone the wall-clock values belong to
   * @returns {DateTick} The parsed DateTick
   * @throws {Error} If the input does not match the pattern
   * @memberof DateTick
   */
  public static parse(
    input: string,
    pattern: string,
    locale: string = 'en',
    timezone: string = DateTick.guessTimezone()
  ): DateTick {
    const acc = { year: 1970, month: 0, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 };
    let pm = false;
    let hasMeridiem = false;
    let epoch: number | null = null;
    let offsetMinutes: number | null = null;
    let regex = '^';
    const handlers: ((value: string) => void)[] = [];
    const digits = (token: string, wide: string, narrow: string): string => (token === wide ? '(\\d{2})' : narrow);
    const unableToParse = (): Error => new Error(`Unable to parse "${input}" with pattern "${pattern}"`);
    const assertRange = (value: number, min: number, max: number): void => {
      if (!Number.isInteger(value) || value < min || value > max) throw unableToParse();
    };

    for (const token of splitTokens(pattern, locale)) {
      switch (token) {
        case 'YYYY':
          regex += '(\\d{4})';
          handlers.push((v) => (acc.year = Number(v)));
          break;
        case 'YY':
          regex += '(\\d{2})';
          handlers.push((v) => (acc.year = 2000 + Number(v)));
          break;
        case 'MMMM':
        case 'MMM': {
          const names = localeMonthNames(locale, token === 'MMMM' ? 'long' : 'short');
          // Match the actual month names (longest-first so a name that prefixes another wins) rather
          // than a greedy `.{1,max}` wildcard, which backtracks into adjacent tokens when there is no
          // separator between them (e.g. `MMMMDo` parsing `May25th`).
          const alternation = [...names]
            .sort((a, b) => b.length - a.length)
            .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
          regex += `(${alternation})`;
          handlers.push((v) => {
            const normalized = v.toLocaleLowerCase(locale);
            const idx = names.findIndex((n) => n.toLocaleLowerCase(locale) === normalized);
            if (idx < 0) throw unableToParse();
            acc.month = idx;
          });
          break;
        }
        case 'MM':
        case 'M':
          regex += digits(token, 'MM', '(\\d{1,2})');
          handlers.push((v) => {
            const month = Number(v);
            assertRange(month, 1, 12);
            acc.month = month - 1;
          });
          break;
        case 'DD':
        case 'D':
          regex += digits(token, 'DD', '(\\d{1,2})');
          handlers.push((v) => {
            const day = Number(v);
            assertRange(day, 1, 31);
            acc.day = day;
          });
          break;
        case 'HH':
        case 'H':
          regex += digits(token, 'HH', '(\\d{1,2})');
          handlers.push((v) => {
            const hour = Number(v);
            assertRange(hour, 0, 23);
            acc.hour = hour;
          });
          break;
        case 'hh':
        case 'h':
          regex += digits(token, 'hh', '(\\d{1,2})');
          handlers.push((v) => {
            const hour = Number(v);
            assertRange(hour, 1, 12);
            acc.hour = hour;
          });
          break;
        case 'mm':
        case 'm':
          regex += digits(token, 'mm', '(\\d{1,2})');
          handlers.push((v) => {
            const minute = Number(v);
            assertRange(minute, 0, 59);
            acc.minute = minute;
          });
          break;
        case 'ss':
        case 's':
          regex += digits(token, 'ss', '(\\d{1,2})');
          handlers.push((v) => {
            const second = Number(v);
            assertRange(second, 0, 59);
            acc.second = second;
          });
          break;
        case 'SSS':
        case 'SS':
        case 'S':
          // Fractional-second tokens: `S` = tenths, `SS` = hundredths, `SSS` = milliseconds.
          // Right-pad to 3 digits so the value scales correctly (e.g. `.9` = 900ms, `.09` = 90ms).
          regex += String.raw`(\d{${token.length}})`;
          handlers.push((v) => (acc.millisecond = Number(v.padEnd(3, '0'))));
          break;
        case 'kk':
        case 'k':
          regex += digits(token, 'kk', '(\\d{1,2})');
          handlers.push((v) => {
            const hour = Number(v);
            assertRange(hour, 1, 24);
            acc.hour = hour % 24;
          });
          break;
        case 'Do':
          regex += '(\\d{1,2})(?:st|nd|rd|th)';
          handlers.push((v) => {
            const day = Number(v);
            assertRange(day, 1, 31);
            acc.day = day;
          });
          break;
        case 'A':
        case 'a':
          regex += `(${meridiemRegexGroup(locale)})`;
          handlers.push((v) => {
            hasMeridiem = true;
            pm = v.toLocaleLowerCase(locale) === localeMeridiems(locale).pm.toLocaleLowerCase(locale);
          });
          break;
        case 'X':
          regex += '(-?\\d{1,16})';
          handlers.push((v) => (epoch = Number(v) * 1000));
          break;
        case 'x':
          regex += '(-?\\d{1,16})';
          handlers.push((v) => (epoch = Number(v)));
          break;
        // Timezone offset: `Z` = `+HH:mm` (or `Z` for UTC), `ZZ` = `+HHmm`. A parsed offset makes the
        // wall-clock values absolute, overriding the `timezone` argument for the resulting instant.
        case 'Z':
        case 'ZZ':
          regex += token === 'Z' ? String.raw`(Z|[+-]\d{2}:\d{2})` : String.raw`(Z|[+-]\d{4})`;
          handlers.push((v) => (offsetMinutes = DateTick.offsetToMinutes(v)));
          break;
        // Derived values that cannot reconstruct an instant on their own: consume but ignore.
        case 'Q':
        case 'w':
        case 'ww':
        case 'wo':
        case 'W':
        case 'WW':
        case 'Wo':
          regex += '(\\d{1,2})(?:st|nd|rd|th)?';
          handlers.push(() => undefined);
          break;
        default: {
          const literal = token.startsWith('[') && token.endsWith(']') ? token.slice(1, -1) : token;
          regex += literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
      }
    }
    regex += '$';

    const match = new RegExp(regex, 'i').exec(input.trim());
    if (!match) throw unableToParse();
    handlers.forEach((handler, i) => handler(match[i + 1]));
    if (epoch !== null) return new DateTick(locale, timezone, new Date(epoch));
    if (hasMeridiem) {
      if (pm && acc.hour < 12) acc.hour += 12;
      if (!pm && acc.hour === 12) acc.hour = 0;
    }
    if (acc.day > getDaysInMonth(acc.year, acc.month)) throw unableToParse();
    // An explicit offset fixes the absolute instant directly; otherwise the wall-clock values are
    // interpreted in the provided timezone.
    if (offsetMinutes !== null) {
      return new DateTick(locale, timezone, new Date(utcFromParts(acc) - offsetMinutes * 60_000));
    }
    return new DateTick(locale, timezone, instantFromParts(acc, timezone));
  }

  private static inputParts(input: DateObject | DateArray): Omit<ZonedParts, 'weekday'> {
    if (Array.isArray(input)) {
      return {
        year: input[0],
        month: input[1],
        day: input[2],
        hour: input[3] ?? 0,
        minute: input[4] ?? 0,
        second: input[5] ?? 0,
        millisecond: input[6] ?? 0,
      };
    }
    return {
      year: input.year,
      month: input.month,
      day: input.date,
      hour: input.hour ?? 0,
      minute: input.minute ?? 0,
      second: input.second ?? 0,
      millisecond: input.millisecond ?? 0,
    };
  }

  // Parses a formatted UTC offset (`+HH:mm`, `+HHmm`, or `Z`) into signed minutes.
  private static offsetToMinutes(value: string): number {
    if (value.toUpperCase() === 'Z') return 0;
    const sign = value.startsWith('-') ? -1 : 1;
    const numeric = value.replace(/\D/g, '');
    return sign * (Number(numeric.slice(0, 2)) * 60 + Number(numeric.slice(2, 4)));
  }

  private static resolveInput(input: DateInput, timezone: string = DateTick.guessTimezone()): Date {
    if (input instanceof DateTick) return input.toDate();
    if (input instanceof Date) return new Date(input.getTime());
    if (typeof input === 'string') return new Date(input);
    if (typeof input === 'number') return new Date(input);
    return instantFromParts(DateTick.inputParts(input), timezone);
  }

  /**
   * Adds a specified amount of time to the wrapped date (chainable, immutable).
   *
   * Calendar units (`date`/`day`, `week`, `month`, `quarter`, `year`) preserve the wall-clock
   * time in the configured timezone (so they survive DST). Fixed-duration units
   * (`millisecond`/`second`/`minute`/`hour`) add absolute time. Month/year additions clamp the day
   * to the last day of the resulting month instead of overflowing (Jan 31 + 1 month -> Feb 28/29).
   *
   * @param {number} amount - The amount to add (negative values subtract)
   * @param {DateUnit} unit - The unit to add (e.g. 'day', 'month')
   * @returns {DateTick} A new DateTick with the result
   * @memberof DateTick
   */
  public add(amount: number, unit: DateUnit): DateTick {
    switch (unit) {
      case 'millisecond':
        return this.withDate(new Date(this._date.getTime() + amount));
      case 'second':
        return this.withDate(new Date(this._date.getTime() + amount * 1000));
      case 'minute':
        return this.withDate(new Date(this._date.getTime() + amount * 60_000));
      case 'hour':
        return this.withDate(new Date(this._date.getTime() + amount * 3_600_000));
      case 'date':
      case 'day':
        return this.rebuild({ day: this.parts().day + amount });
      case 'week':
        return this.rebuild({ day: this.parts().day + amount * 7 });
      case 'month':
        return this.addMonths(amount);
      case 'quarter':
        return this.addMonths(amount * 3);
      case 'year':
        return this.addMonths(amount * 12);
      default:
        return this.clone();
    }
  }

  /**
   * Formats the date as a calendar-style relative label such as "Today at 7:23 PM".
   *
   * @param {DateInput} [reference] - The date to compare against (defaults to now)
   * @param {CalendarDisplayFormats} [formats] - Token patterns or callbacks for each calendar bucket
   * @returns {string} The calendar-style label
   * @memberof DateTick
   */
  public calendar(reference: DateInput = new Date(), formats: CalendarDisplayFormats = {}): string {
    const diff = this.diffCalendar(reference, 'day');
    const key =
      diff < -6
        ? 'sameElse'
        : diff < -1
          ? 'lastWeek'
          : diff === -1
            ? 'lastDay'
            : diff === 0
              ? 'sameDay'
              : diff === 1
                ? 'nextDay'
                : diff < 7
                  ? 'nextWeek'
                  : 'sameElse';
    const defaults: Required<CalendarDisplayFormats> = {
      sameDay: '[Today at] LT',
      nextDay: '[Tomorrow at] LT',
      nextWeek: 'dddd [at] LT',
      lastDay: '[Yesterday at] LT',
      lastWeek: '[Last] dddd [at] LT',
      sameElse: 'L',
    };
    const format = formats[key] ?? defaults[key];
    return typeof format === 'function' ? format(this) : this.formatPattern(format);
  }

  /**
   * Returns localized month-grid data for rendering a calendar UI.
   *
   * The grid is padded with adjacent-month dates so every week has seven cells,
   * and the weekday order follows the configured `weekStartsOn`.
   *
   * @returns {CalendarMonth} Calendar data for the wrapped date's month
   * @memberof DateTick
   */
  public calendarMonth(options: CalendarMonthOptions = {}): CalendarMonth {
    const selected =
      options.selected === false
        ? null
        : partsOf(options.selected === undefined ? this._date : this.toComparable(options.selected), this._timezone);
    const firstOfMonth = this.rebuild({ day: 1 }).startOf('day');
    const first = firstOfMonth.parts();
    const leadingDays = (first.weekday - this._weekStartsOn + 7) % 7;
    const daysInMonth = getDaysInMonth(first.year, first.month);
    const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
    const start = firstOfMonth.subtract(leadingDays, 'day');
    const today = new DateTick(this._locale, this._timezone, new Date(), this._weekStartsOn).parts();
    const monthLabel = new Intl.DateTimeFormat(this._locale, {
      month: 'long',
      year: 'numeric',
      timeZone: this._timezone,
    }).format(firstOfMonth.toDate());
    const formatDate = (date: DateTick): string => {
      if (options.dateFormat == null) {
        return date.format({ year: 'numeric', month: '2-digit', day: '2-digit' });
      }
      if (typeof options.dateFormat === 'function') return options.dateFormat(date);
      if (typeof options.dateFormat === 'string') return date.formatPattern(options.dateFormat);
      return date.format(options.dateFormat);
    };

    const weekdays: CalendarWeekday[] = Array.from({ length: 7 }, (_, i) => {
      const day = (this._weekStartsOn + i) % 7;
      const sample = new Date(Date.UTC(2020, 5, 7 + day));
      return {
        day,
        isoDay: day === 0 ? 7 : day,
        long: new Intl.DateTimeFormat(this._locale, { weekday: 'long', timeZone: 'UTC' }).format(sample),
        short: new Intl.DateTimeFormat(this._locale, { weekday: 'short', timeZone: 'UTC' }).format(sample),
        narrow: new Intl.DateTimeFormat(this._locale, { weekday: 'narrow', timeZone: 'UTC' }).format(sample),
      };
    });

    const days: CalendarDate[] = Array.from({ length: cellCount }, (_, i) => {
      const value = start.add(i, 'day');
      const p = value.parts();
      return {
        value,
        isoDate: value.formatPattern('YYYY-MM-DD'),
        formatted: formatDate(value),
        year: p.year,
        month: p.month,
        date: p.day,
        day: p.weekday,
        isoDay: p.weekday === 0 ? 7 : p.weekday,
        isCurrentMonth: p.year === first.year && p.month === first.month,
        isToday: p.year === today.year && p.month === today.month && p.day === today.day,
        isSelected: Boolean(
          selected && p.year === selected.year && p.month === selected.month && p.day === selected.day
        ),
      };
    });

    return {
      year: first.year,
      month: first.month,
      label: monthLabel,
      weekdays,
      days,
      weeks: Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7)),
    };
  }

  /**
   * Returns a new DateTick with the exact same instant, locale and timezone
   *
   * @returns {DateTick} The cloned instance
   * @memberof DateTick
   */
  public clone(): DateTick {
    return this.withDate(this._date);
  }

  /**
   * Gets or sets the day of the month (in the configured timezone)
   *
   * @param {number} [value] - The day of the month to set
   * @returns {number | DateTick} The day of the month, or a new DateTick when setting
   * @memberof DateTick
   */
  public date(): number;
  public date(value: number): DateTick;
  public date(value?: number): number | DateTick {
    if (value == null) return this.parts().day;
    return this.rebuild({ day: value });
  }

  /** Plural alias of {@link DateTick.date} (day of the month). */
  public dates(): number;
  public dates(value: number): DateTick;
  public dates(value?: number): number | DateTick {
    return value == null ? this.date() : this.date(value);
  }

  /**
   * Gets or sets the day of the week (0 = Sunday … 6 = Saturday, in the configured timezone)
   *
   * @param {number} [value] - The day of the week to set
   * @returns {number | DateTick} The day of the week, or a new DateTick when setting
   * @memberof DateTick
   */
  public day(): number;
  public day(value: number): DateTick;
  public day(value?: number): number | DateTick {
    const p = this.parts();
    if (value == null) return p.weekday;
    return this.rebuild({ day: p.day - p.weekday + value });
  }

  /**
   * Gets or sets the day of the year (1-based, in the configured timezone).
   *
   * Setting beyond the number of days in the year rolls over into the following year(s),
   * the same way a native `Date` rolls over an out-of-range day-of-month.
   *
   * @param {number} [value] - The day of the year to set
   * @returns {number | DateTick} The day of the year, or a new DateTick when setting
   * @memberof DateTick
   */
  public dayOfYear(): number;
  public dayOfYear(value: number): DateTick;
  public dayOfYear(value?: number): number | DateTick {
    if (value == null) {
      const p = this.parts();
      const startOfYear = Date.UTC(p.year, 0, 1);
      const current = Date.UTC(p.year, p.month, p.day);
      return Math.round((current - startOfYear) / 86_400_000) + 1;
    }
    return this.rebuild({ month: 0, day: value });
  }

  /** Plural alias of {@link DateTick.day} (day of the week). */
  public days(): number;
  public days(value: number): DateTick;
  public days(value?: number): number | DateTick {
    return value == null ? this.day() : this.day(value);
  }

  /**
   * Gets the number of days in the wrapped date's month (in the configured timezone)
   *
   * @returns {number} The number of days in the month
   * @memberof DateTick
   */
  public daysInMonth(): number {
    const p = this.parts();
    return getDaysInMonth(p.year, p.month);
  }

  /**
   * Gets the difference between the wrapped date and another date.
   *
   * @param {DateInput} date - The date to compare against
   * @param {DateUnit} [unit='millisecond'] - The unit of measurement
   * @param {boolean} [precise=false] - When true, returns a floating-point value instead of truncating.
   * For `month`/`quarter`/`year` the fractional part reflects progress through the current calendar unit.
   * @returns {number} The difference (positive when the wrapped date is later)
   * @memberof DateTick
   */
  public diff(date: DateInput, unit: DateUnit = 'millisecond', precise: boolean = false): number {
    const other = this.toComparable(date);
    const diffMs = this._date.getTime() - other.getTime();
    const scale = (ms: number): number => (precise ? ms : Math.trunc(ms));
    switch (unit) {
      case 'millisecond':
        return diffMs;
      case 'second':
        return scale(diffMs / 1000);
      case 'minute':
        return scale(diffMs / 60_000);
      case 'hour':
        return scale(diffMs / 3_600_000);
      case 'date':
      case 'day':
        return scale(diffMs / 86_400_000);
      case 'week':
        return scale(diffMs / 604_800_000);
      case 'month':
        return precise ? this.preciseCalendarDiff(other, 1) : this.wholeMonthDiff(other, 1);
      case 'quarter':
        return precise ? this.preciseCalendarDiff(other, 3) : this.wholeMonthDiff(other, 3);
      case 'year':
        return precise ? this.preciseCalendarDiff(other, 12) : this.wholeMonthDiff(other, 12);
      default:
        return diffMs;
    }
  }

  /**
   * Calendar-boundary difference in the configured timezone.
   *
   * Unlike {@link DateTick.diff}, this counts calendar units rather than elapsed duration.
   * For example, Friday 23:00 to Saturday 01:00 is one calendar day apart even though
   * only two hours elapsed.
   *
   * @param {DateInput} date - The date to compare against
   * @param {CalendarDiffUnit} [unit='day'] - Calendar unit to compare
   * @returns {number} The calendar difference, positive when this instance is later
   * @memberof DateTick
   */
  public diffCalendar(date: DateInput, unit: CalendarDiffUnit = 'day'): number {
    const other = this.withDate(this.toComparable(date));
    switch (unit) {
      case 'date':
      case 'day':
        return this.calendarDayNumber() - other.calendarDayNumber();
      case 'week':
        return Math.trunc((this.startOf('week').calendarDayNumber() - other.startOf('week').calendarDayNumber()) / 7);
      case 'month': {
        const a = this.parts();
        const b = other.parts();
        return (a.year - b.year) * 12 + (a.month - b.month);
      }
      case 'quarter': {
        const a = this.parts();
        const b = other.parts();
        return (a.year - b.year) * 4 + (Math.floor(a.month / 3) - Math.floor(b.month / 3));
      }
      case 'year':
        return this.parts().year - other.parts().year;
      default:
        return Number.NaN;
    }
  }

  /**
   * Returns a new DateTick set to the end of the given unit (one millisecond before the next unit starts)
   *
   * @param {DateUnit} unit - The unit to snap to (e.g. 'month', 'day')
   * @returns {DateTick} A new DateTick at the end of the unit
   * @memberof DateTick
   */
  public endOf(unit: DateUnit): DateTick {
    if (unit === 'millisecond') return this.clone();
    const next = this.startOf(unit).add(1, unit);
    return this.withDate(new Date(next.valueOf() - 1));
  }

  /**
   * Formats a date using Intl.DateTimeFormat or a preset (in the configured timezone)
   *
   * @param {Intl.DateTimeFormatOptions | DateFormatPreset} [format] - Format options or preset
   * @returns {string} The formatted date string
   * @memberof DateTick
   */
  public format(format?: Intl.DateTimeFormatOptions | DateFormatPreset): string {
    const options = typeof format === 'string' ? this.getPreset(format) : format;
    return new Intl.DateTimeFormat(this._locale, {
      timeZone: this._timezone,
      ...options,
    }).format(this._date);
  }

  /**
   * Formats the date using a token pattern, resolved in the configured timezone.
   *
   * Core tokens: `YYYY` `YY` `MMMM` `MMM` `MM` `M` `DD` `D` `dddd` `ddd` `dd` `d` `HH` `H` `hh` `h`
   * `mm` `m` `ss` `s` `SSS` `SS` `S` `A` `a` `Z` `ZZ`. Advanced: `Do` `Q` `k` `kk` `X` `x` `w` `ww` `wo` `W` `WW` `Wo`.
   * Localized (resolved to the configured locale's field order and separators): `L` `LL` `LLL` `LLLL`
   * `l` `ll` `lll` `llll` `LT` `LTS`. Wrap literal text in `[square brackets]`.
   *
   * @param {string} pattern - The token pattern (e.g. 'DD/MM/YYYY HH:mm')
   * @returns {string} The formatted string
   * @example date.formatPattern('DD/MM/YYYY') // '25/06/2026'
   * @memberof DateTick
   */
  public formatPattern(pattern: string): string {
    const p = this.parts();
    const two = (n: number): string => String(n).padStart(2, '0');
    const intl = (opts: Intl.DateTimeFormatOptions): string =>
      new Intl.DateTimeFormat(this._locale, { timeZone: this._timezone, ...opts }).format(this._date);
    const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
    const hour24From1 = p.hour === 0 ? 24 : p.hour;
    const meridiem = localeMeridiems(this._locale);
    const dayPeriod = p.hour < 12 ? meridiem.am : meridiem.pm;
    const map: Record<string, string> = {
      YYYY: String(p.year).padStart(4, '0'),
      YY: two(p.year % 100),
      MMMM: intl({ month: 'long' }),
      MMM: intl({ month: 'short' }),
      MM: two(p.month + 1),
      M: String(p.month + 1),
      Do: this.ordinal(),
      DD: two(p.day),
      D: String(p.day),
      dddd: intl({ weekday: 'long' }),
      ddd: intl({ weekday: 'short' }),
      dd: intl({ weekday: 'narrow' }),
      d: String(p.weekday),
      HH: two(p.hour),
      H: String(p.hour),
      hh: two(hour12),
      h: String(hour12),
      kk: two(hour24From1),
      k: String(hour24From1),
      mm: two(p.minute),
      m: String(p.minute),
      SSS: String(p.millisecond).padStart(3, '0'),
      SS: String(p.millisecond).padStart(3, '0').slice(0, 2),
      S: String(p.millisecond).padStart(3, '0').slice(0, 1),
      ss: two(p.second),
      s: String(p.second),
      A: dayPeriod,
      a: dayPeriod.toLocaleLowerCase(this._locale),
      Q: String(this.quarter()),
      ww: two(this.week()),
      w: String(this.week()),
      wo: this.ordinalFor(this.week()),
      WW: two(this.isoWeek()),
      W: String(this.isoWeek()),
      Wo: this.ordinalFor(this.isoWeek()),
      X: String(this.unix()),
      x: String(this.valueOf()),
      Z: this.offsetString(true),
      ZZ: this.offsetString(false),
    };
    return splitTokens(pattern, this._locale)
      .map((token) => {
        if (token.startsWith('[') && token.endsWith(']')) return token.slice(1, -1);
        return token in map ? map[token] : token;
      })
      .join('');
  }

  /**
   * Formats the date relative to another date.
   *
   * @param {DateInput} date - The date to compare from
   * @param {boolean} [withoutSuffix=false] - When true, omit "ago" / "in"
   * @returns {string} The relative-time label
   * @memberof DateTick
   */
  public from(date: DateInput, withoutSuffix: boolean = false): string {
    const diff = this._date.getTime() - this.toComparable(date).getTime();
    const duration = DateTick.duration(diff, 'millisecond', this._locale);
    return withoutSuffix ? duration.humanize() : duration.humanize(true);
  }

  /**
   * Formats the date relative to now.
   *
   * @param {boolean} [withoutSuffix=false] - When true, omit "ago" / "in"
   * @returns {string} The relative-time label
   * @memberof DateTick
   */
  public fromNow(withoutSuffix: boolean = false): string {
    return this.from(new Date(), withoutSuffix);
  }

  /**
   * Gets a specific unit (or derived value) from the wrapped date
   *
   * @param {DateGettableUnit} unit - The unit to get (e.g. 'year', 'isoWeek')
   * @returns {number} The value of the unit
   * @memberof DateTick
   */
  public get(unit: DateGettableUnit): number {
    switch (unit) {
      case 'millisecond':
        return this.millisecond();
      case 'second':
        return this.second();
      case 'minute':
        return this.minute();
      case 'hour':
        return this.hour();
      case 'date':
        return this.date();
      case 'day':
        return this.day();
      case 'week':
        return this.week();
      case 'month':
        return this.month();
      case 'quarter':
        return this.quarter();
      case 'year':
        return this.year();
      case 'dayOfYear':
        return this.dayOfYear();
      case 'isoDay':
        return this.isoDay();
      case 'isoWeek':
        return this.isoWeek();
      case 'isoWeekYear':
        return this.isoWeekYear();
      case 'isoWeeksInYear':
        return this.isoWeeksInYear();
      case 'weekYear':
        return this.weekYear();
      case 'weekday':
        return this.weekday();
      case 'weeksInYear':
        return this.weeksInYear();
      case 'daysInMonth':
        return this.daysInMonth();
      default:
        return Number.NaN;
    }
  }

  /**
   * Gets or sets the hour (in the configured timezone)
   *
   * @param {number} [value] - The hour to set
   * @returns {number | DateTick} The hour, or a new DateTick when setting
   * @memberof DateTick
   */
  public hour(): number;
  public hour(value: number): DateTick;
  public hour(value?: number): number | DateTick {
    if (value == null) return this.parts().hour;
    return this.rebuild({ hour: value });
  }

  /** Plural alias of {@link DateTick.hour}. */
  public hours(): number;
  public hours(value: number): DateTick;
  public hours(value?: number): number | DateTick {
    return value == null ? this.hour() : this.hour(value);
  }

  /**
   * Checks if the wrapped date is strictly after another date, optionally truncated to a unit
   *
   * @param {DateInput} date - The date to compare against
   * @param {DateUnit} [unit] - When provided, compares after snapping both dates to the start of this unit
   * @returns {boolean} True if the wrapped date is later
   * @memberof DateTick
   */
  public isAfter(date: DateInput, unit?: DateUnit): boolean {
    const other = this.toComparable(date);
    if (!unit) return this._date.getTime() > other.getTime();
    return this.startOf(unit).valueOf() > this.withDate(other).startOf(unit).valueOf();
  }

  /**
   * Checks if the wrapped date is strictly before another date, optionally truncated to a unit
   *
   * @param {DateInput} date - The date to compare against
   * @param {DateUnit} [unit] - When provided, compares after snapping both dates to the start of this unit
   * @returns {boolean} True if the wrapped date is earlier
   * @memberof DateTick
   */
  public isBefore(date: DateInput, unit?: DateUnit): boolean {
    const other = this.toComparable(date);
    if (!unit) return this._date.getTime() < other.getTime();
    return this.startOf(unit).valueOf() < this.withDate(other).startOf(unit).valueOf();
  }

  /**
   * Checks if the wrapped date falls between two dates.
   *
   * @param {DateInput} start - The lower bound
   * @param {DateInput} end - The upper bound
   * @param {boolean | Inclusivity} [inclusivity=false] - `false`/`'()'` excludes both bounds,
   * `true`/`'[]'` includes both, or use `'(]'`/`'[)'` to control each side independently
   * @returns {boolean} True if the wrapped date is between start and end
   * @memberof DateTick
   */
  public isBetween(start: DateInput, end: DateInput, inclusivity: boolean | Inclusivity = false): boolean {
    const time = this._date.getTime();
    const startTime = this.toComparable(start).getTime();
    const endTime = this.toComparable(end).getTime();
    const mode = typeof inclusivity === 'boolean' ? (inclusivity ? '[]' : '()') : inclusivity;
    const afterStart = mode[0] === '[' ? time >= startTime : time > startTime;
    const beforeEnd = mode[1] === ']' ? time <= endTime : time < endTime;
    return afterStart && beforeEnd;
  }

  /**
   * Checks if the wrapped date's year is a leap year (in the configured timezone)
   *
   * @returns {boolean} True if the year is a leap year
   * @memberof DateTick
   */
  public isLeapYear(): boolean {
    const year = this.parts().year;
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * Checks if the wrapped date is the same as another date, optionally truncated to a unit
   *
   * @param {DateInput} date - The date to compare against
   * @param {DateUnit} [unit] - When provided, compares after snapping both dates to the start of this unit
   * @returns {boolean} True if the dates are the same
   * @memberof DateTick
   */
  public isSame(date: DateInput, unit?: DateUnit): boolean {
    const other = this.toComparable(date);
    if (!unit) return this._date.getTime() === other.getTime();
    return this.startOf(unit).valueOf() === this.withDate(other).startOf(unit).valueOf();
  }

  /**
   * Checks if the wrapped date is the same as or after another date, optionally truncated to a unit
   *
   * @param {DateInput} date - The date to compare against
   * @param {DateUnit} [unit] - When provided, compares after snapping both dates to the start of this unit
   * @returns {boolean} True if the wrapped date is the same as or later than the other
   * @memberof DateTick
   */
  public isSameOrAfter(date: DateInput, unit?: DateUnit): boolean {
    return this.isSame(date, unit) || this.isAfter(date, unit);
  }

  /**
   * Checks if the wrapped date is the same as or before another date, optionally truncated to a unit
   *
   * @param {DateInput} date - The date to compare against
   * @param {DateUnit} [unit] - When provided, compares after snapping both dates to the start of this unit
   * @returns {boolean} True if the wrapped date is the same as or earlier than the other
   * @memberof DateTick
   */
  public isSameOrBefore(date: DateInput, unit?: DateUnit): boolean {
    return this.isSame(date, unit) || this.isBefore(date, unit);
  }

  /**
   * Checks if the wrapped date is today in the configured timezone.
   *
   * @returns {boolean} True if the date is today
   * @memberof DateTick
   */
  public isToday(): boolean {
    return this.diffCalendar(new Date(), 'day') === 0;
  }

  /**
   * Checks if the wrapped date is tomorrow in the configured timezone.
   *
   * @returns {boolean} True if the date is tomorrow
   * @memberof DateTick
   */
  public isTomorrow(): boolean {
    return this.diffCalendar(new Date(), 'day') === 1;
  }

  /**
   * Checks whether the wrapped date itself is a valid date
   *
   * @returns {boolean} True if valid, false otherwise
   * @memberof DateTick
   */
  public isValid(): boolean {
    return DateTick.isValid(this._date);
  }

  /**
   * Checks if the wrapped date is yesterday in the configured timezone.
   *
   * @returns {boolean} True if the date is yesterday
   * @memberof DateTick
   */
  public isYesterday(): boolean {
    return this.diffCalendar(new Date(), 'day') === -1;
  }

  /**
   * Gets the ISO day of the week (1-7, Monday-Sunday, in the configured timezone)
   *
   * @returns {number} The ISO day
   * @memberof DateTick
   */
  public isoDay(): number {
    const weekday = this.parts().weekday;
    return weekday === 0 ? 7 : weekday;
  }

  /**
   * Gets the ISO week number (in the configured timezone)
   *
   * @returns {number} The ISO week number
   * @memberof DateTick
   */
  public isoWeek(): number {
    const target = this.isoThursday();
    const yearStart = utcDateFromYMD(target.getUTCFullYear(), 0, 1);
    return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  }

  /**
   * Gets the ISO week year (in the configured timezone)
   *
   * @returns {number} The ISO week year
   * @memberof DateTick
   */
  public isoWeekYear(): number {
    return this.weekYear();
  }

  /**
   * Gets the number of ISO weeks in the year (in the configured timezone)
   *
   * @returns {number} The number of ISO weeks
   * @memberof DateTick
   */
  public isoWeeksInYear(): number {
    return this.weeksInYearBy((t) => t.isoWeek());
  }

  /**
   * Returns a new DateTick in the runtime's local timezone, keeping the same instant.
   *
   * @returns {DateTick} The local-timezone instance
   * @memberof DateTick
   */
  public local(): DateTick {
    return this.withTimezone(DateTick.guessTimezone());
  }

  /**
   * Gets the configured locale
   *
   * @returns {string} The BCP 47 locale
   * @memberof DateTick
   */
  public locale(): string {
    return this._locale;
  }

  /**
   * Returns locale metadata (month/weekday names, first day of week, meridiems, ordinal), resolved
   * through `Intl`.
   *
   * @returns {LocaleData} The locale metadata
   * @example datetick('2026-06-25', { locale: 'fr' }).localeData().months()[0] // 'janvier'
   * @memberof DateTick
   */
  public localeData(): LocaleData {
    const locale = this._locale;
    const meridiems = localeMeridiems(locale);
    return {
      months: () => localeMonthNames(locale, 'long'),
      monthsShort: () => localeMonthNames(locale, 'short'),
      weekdays: () => localeWeekdayNames(locale, 'long'),
      weekdaysShort: () => localeWeekdayNames(locale, 'short'),
      weekdaysMin: () => localeWeekdayNames(locale, 'narrow'),
      firstDayOfWeek: () => this._weekStartsOn,
      meridiems: () => ({ ...meridiems }),
      meridiem: (hour, isLowercase = false): string => {
        const marker = hour < 12 ? meridiems.am : meridiems.pm;
        return isLowercase ? marker.toLocaleLowerCase(locale) : marker;
      },
      ordinal: (n) => this.ordinalFor(n),
    };
  }

  /**
   * Gets or sets the milliseconds
   *
   * @param {number} [value] - The milliseconds to set
   * @returns {number | DateTick} The milliseconds, or a new DateTick when setting
   * @memberof DateTick
   */
  public millisecond(): number;
  public millisecond(value: number): DateTick;
  public millisecond(value?: number): number | DateTick {
    if (value == null) return this.parts().millisecond;
    return this.rebuild({ millisecond: value });
  }

  /** Plural alias of {@link DateTick.millisecond}. */
  public milliseconds(): number;
  public milliseconds(value: number): DateTick;
  public milliseconds(value?: number): number | DateTick {
    return value == null ? this.millisecond() : this.millisecond(value);
  }

  /**
   * Gets or sets the minutes (in the configured timezone)
   *
   * @param {number} [value] - The minutes to set
   * @returns {number | DateTick} The minutes, or a new DateTick when setting
   * @memberof DateTick
   */
  public minute(): number;
  public minute(value: number): DateTick;
  public minute(value?: number): number | DateTick {
    if (value == null) return this.parts().minute;
    return this.rebuild({ minute: value });
  }

  /** Plural alias of {@link DateTick.minute}. */
  public minutes(): number;
  public minutes(value: number): DateTick;
  public minutes(value?: number): number | DateTick {
    return value == null ? this.minute() : this.minute(value);
  }

  /**
   * Gets or sets the month (0-11, in the configured timezone)
   *
   * When setting, the day is clamped to the last valid day of the target month instead of
   * overflowing (Mar 31 -> month Feb -> Feb 28/29), matching {@link DateTick.add}.
   *
   * @param {number} [value] - The month to set
   * @returns {number | DateTick} The month, or a new DateTick when setting
   * @memberof DateTick
   */
  public month(): number;
  public month(value: number): DateTick;
  public month(value?: number): number | DateTick {
    if (value == null) return this.parts().month;
    const p = this.parts();
    // Normalize any month overflow into year/month (matching add()'s calendar math), then clamp the
    // day to the last valid day of the target month instead of overflowing (Mar 31 -> month Feb ->
    // Feb 28/29), keeping the setter consistent with add().
    const totalMonths = p.year * 12 + value;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const targetDay = Math.min(p.day, getDaysInMonth(targetYear, targetMonth));
    return this.rebuild({ year: targetYear, month: targetMonth, day: targetDay });
  }

  /** Plural alias of {@link DateTick.month}. */
  public months(): number;
  public months(value: number): DateTick;
  public months(value?: number): number | DateTick {
    return value == null ? this.month() : this.month(value);
  }

  /**
   * Gets the day of the month with its ordinal suffix (e.g. '1st', '22nd', '31st'). English by default,
   * or the factory's `ordinal` override when one is configured.
   *
   * @returns {string} The ordinal day-of-month
   * @memberof DateTick
   */
  public ordinal(): string {
    return this.ordinalFor(this.parts().day);
  }
  /**
   * Gets or sets the quarter of the year (1-4, in the configured timezone).
   *
   * Setting preserves the current month's offset within its quarter (e.g. the 2nd month of
   * the quarter stays the 2nd month) while moving to the target quarter.
   *
   * @param {number} [value] - The quarter (1-4) to set
   * @returns {number | DateTick} The quarter, or a new DateTick when setting
   * @memberof DateTick
   */
  public quarter(): number;
  public quarter(value: number): DateTick;
  public quarter(value?: number): number | DateTick {
    const month = this.parts().month;
    if (value == null) return Math.floor(month / 3) + 1;
    return this.month((month % 3) + 3 * (value - 1));
  }

  /**
   * Gets or sets the seconds (in the configured timezone)
   *
   * @param {number} [value] - The seconds to set
   * @returns {number | DateTick} The seconds, or a new DateTick when setting
   * @memberof DateTick
   */
  public second(): number;
  public second(value: number): DateTick;
  public second(value?: number): number | DateTick {
    if (value == null) return this.parts().second;
    return this.rebuild({ second: value });
  }

  /** Plural alias of {@link DateTick.second}. */
  public seconds(): number;
  public seconds(value: number): DateTick;
  public seconds(value?: number): number | DateTick {
    return value == null ? this.second() : this.second(value);
  }

  /**
   * Sets a specific unit on the wrapped date
   *
   * @param {DateUnit} unit - The unit to set (e.g. 'year', 'month')
   * @param {number} value - The value to set
   * @returns {DateTick} A new DateTick with the result
   * @memberof DateTick
   */
  public set(unit: DateUnit, value: number): DateTick {
    switch (unit) {
      case 'millisecond':
        return this.millisecond(value);
      case 'second':
        return this.second(value);
      case 'minute':
        return this.minute(value);
      case 'hour':
        return this.hour(value);
      case 'date':
        return this.date(value);
      case 'day':
        return this.day(value);
      case 'month':
        return this.month(value);
      case 'quarter':
        return this.quarter(value);
      case 'year':
        return this.year(value);
      default:
        throw new Error(`Invalid unit for set(): ${unit}`);
    }
  }

  /**
   * Returns a new DateTick set to the start of the given unit (in the configured timezone)
   *
   * @param {DateUnit} unit - The unit to snap to (e.g. 'month', 'day')
   * @returns {DateTick} A new DateTick at the start of the unit
   * @memberof DateTick
   */
  public startOf(unit: DateUnit): DateTick {
    const p = this.parts();
    switch (unit) {
      case 'year':
        return this.rebuild({ month: 0, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });
      case 'quarter':
        return this.rebuild({
          month: Math.floor(p.month / 3) * 3,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
      case 'month':
        return this.rebuild({ day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });
      case 'week': {
        const offset = (p.weekday - this._weekStartsOn + 7) % 7;
        return this.rebuild({ day: p.day - offset, hour: 0, minute: 0, second: 0, millisecond: 0 });
      }
      case 'date':
      case 'day':
        return this.rebuild({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      case 'hour':
        return this.rebuild({ minute: 0, second: 0, millisecond: 0 });
      case 'minute':
        return this.rebuild({ second: 0, millisecond: 0 });
      case 'second':
        return this.rebuild({ millisecond: 0 });
      default:
        return this.clone();
    }
  }

  /**
   * Subtracts a specified amount of time from the wrapped date (chainable, immutable)
   *
   * @param {number} amount - The amount to subtract
   * @param {DateUnit} unit - The unit to subtract (e.g. 'day', 'month')
   * @returns {DateTick} A new DateTick with the result
   * @memberof DateTick
   */
  public subtract(amount: number, unit: DateUnit): DateTick {
    return this.add(-amount, unit);
  }

  /**
   * Returns a human-readable relative time string (e.g. '3 minutes ago')
   *
   * @param {Intl.RelativeTimeFormatOptions} [options] - Intl options
   * @param {RelativeTimeThresholds} [thresholds] - Override the unit step-up cutoffs
   * @returns {string} The relative time string
   * @memberof DateTick
   */
  public timeAgo(options?: Intl.RelativeTimeFormatOptions, thresholds: RelativeTimeThresholds = {}): string {
    const t = {
      second: thresholds.second ?? 60,
      minute: thresholds.minute ?? 60,
      hour: thresholds.hour ?? 24,
      day: thresholds.day ?? 30,
      month: thresholds.month ?? 12,
    };
    const diff = this._date.getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat(this._locale, { numeric: 'auto', ...options });
    const seconds = diff / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;
    const months = days / 30;
    const years = days / 365;
    if (Math.abs(seconds) < t.second) return rtf.format(Math.round(seconds), 'second');
    if (Math.abs(minutes) < t.minute) return rtf.format(Math.round(minutes), 'minute');
    if (Math.abs(hours) < t.hour) return rtf.format(Math.round(hours), 'hour');
    if (Math.abs(days) < t.day) return rtf.format(Math.round(days), 'day');
    if (Math.abs(months) < t.month) return rtf.format(Math.round(months), 'month');
    return rtf.format(Math.round(years), 'year');
  }

  /**
   * Returns a dependency-free live relative-time stream.
   *
   * Subscribers receive the current `timeAgo()` label immediately, then again whenever it is
   * expected to change. The refresh rate adapts from every second to every hour as the target
   * time moves farther away.
   *
   * @param {Intl.RelativeTimeFormatOptions} [options] - Intl options
   * @param {RelativeTimeThresholds} [thresholds] - Override the unit step-up cutoffs
   * @returns {TimeAgoLive} A live relative-time subscription handle
   * @memberof DateTick
   */
  public timeAgoLive(options?: Intl.RelativeTimeFormatOptions, thresholds?: RelativeTimeThresholds): TimeAgoLive {
    return this.liveRelativeTime(() => this.timeAgo(options, thresholds));
  }

  /**
   * Subscribes to live relative-time labels and returns an unsubscribe function.
   *
   * @param {TimeAgoListener} listener - Receives each formatted relative-time label
   * @param {Intl.RelativeTimeFormatOptions} [options] - Intl options
   * @param {RelativeTimeThresholds} [thresholds] - Override the unit step-up cutoffs
   * @returns {() => void} Function that stops the live updates
   * @memberof DateTick
   */
  public timeAgoSubscribe(
    listener: TimeAgoListener,
    options?: Intl.RelativeTimeFormatOptions,
    thresholds?: RelativeTimeThresholds
  ): () => void {
    return this.timeAgoLive(options, thresholds).subscribe(listener);
  }

  /**
   * Gets the configured IANA timezone
   *
   * @returns {string} The timezone
   * @memberof DateTick
   */
  public timezone(): string {
    return this._timezone;
  }

  /**
   * Formats another date relative to this one.
   *
   * @param {DateInput} date - The target date to compare to
   * @param {boolean} [withoutSuffix=false] - When true, omit "ago" / "in"
   * @returns {string} The relative-time label
   * @memberof DateTick
   */
  public to(date: DateInput, withoutSuffix: boolean = false): string {
    return this.withDate(date).from(this, withoutSuffix);
  }

  /**
   * Converts the wrapped date to an array of zoned calendar parts.
   *
   * @returns {DateArray} [year, month, date, hour, minute, second, millisecond]
   * @memberof DateTick
   */
  public toArray(): Required<DateArray> {
    const p = this.parts();
    return [p.year, p.month, p.day, p.hour, p.minute, p.second, p.millisecond];
  }

  /**
   * Converts the wrapped date to a plain Date object (a fresh clone of the absolute instant)
   *
   * @returns {Date} The Date object
   * @memberof DateTick
   */
  public toDate(): Date {
    return new Date(this._date);
  }

  /**
   * Converts the wrapped date to an ISO 8601 string (UTC)
   *
   * @returns {string} The ISO 8601 string
   * @memberof DateTick
   */
  public toISOString(): string {
    return this._date.toISOString();
  }

  /**
   * Enables `JSON.stringify` to serialize a DateTick as an ISO 8601 string
   *
   * @returns {string} The ISO 8601 string
   * @memberof DateTick
   */
  public toJSON(): string {
    return this.toISOString();
  }

  /**
   * Formats now relative to this date.
   *
   * @param {boolean} [withoutSuffix=false] - When true, omit "ago" / "in"
   * @returns {string} The relative-time label
   * @memberof DateTick
   */
  public toNow(withoutSuffix: boolean = false): string {
    return this.to(new Date(), withoutSuffix);
  }

  /**
   * Converts the wrapped date to an object of zoned calendar parts.
   *
   * @returns {DatePartsObject} Zoned calendar parts
   * @memberof DateTick
   */
  public toObject(): DatePartsObject {
    const p = this.parts();
    return {
      year: p.year,
      month: p.month,
      date: p.day,
      hour: p.hour,
      minute: p.minute,
      second: p.second,
      millisecond: p.millisecond,
      day: p.weekday,
    };
  }

  /**
   * Converts the wrapped date to its default string representation
   *
   * @returns {string} The string representation
   * @memberof DateTick
   */
  public toString(): string {
    return this._date.toString();
  }

  /**
   * Gets the Unix timestamp (seconds since epoch)
   *
   * @returns {number} The Unix timestamp in seconds
   * @memberof DateTick
   */
  public unix(): number {
    return Math.floor(this._date.getTime() / 1000);
  }

  /**
   * Returns a new DateTick in UTC, keeping the same instant.
   *
   * @returns {DateTick} The UTC instance
   * @memberof DateTick
   */
  public utc(): DateTick {
    return this.withTimezone('UTC');
  }

  /**
   * Gets the configured timezone's UTC offset for this instant, in minutes.
   *
   * @returns {number} Offset minutes, positive east of UTC
   * @memberof DateTick
   */
  public utcOffset(): number {
    return offsetMs(this._date, this._timezone) / 60_000;
  }

  /**
   * Gets the timestamp in milliseconds since epoch. Enables direct numeric comparisons (e.g. `+datetick`)
   *
   * @returns {number} The timestamp in milliseconds
   * @memberof DateTick
   */
  public valueOf(): number {
    return this._date.getTime();
  }

  /**
   * Gets the week number of the year (in the configured timezone)
   *
   * @returns {number} The week number
   * @memberof DateTick
   */
  public week(): number {
    const p = this.parts();
    const jan1Weekday = utcDateFromYMD(p.year, 0, 1).getUTCDay();
    const offset = (jan1Weekday - this._weekStartsOn + 7) % 7;
    return Math.ceil((this.dayOfYear() + offset) / 7);
  }

  /**
   * Gets the configured first day of the week (0 = Sunday … 6 = Saturday)
   *
   * @returns {number} The first day of the week
   * @memberof DateTick
   */
  public weekStart(): number {
    return this._weekStartsOn;
  }

  /**
   * Gets the week year, for ISO week calculations (in the configured timezone)
   *
   * @returns {number} The week year
   * @memberof DateTick
   */
  public weekYear(): number {
    return this.isoThursday().getUTCFullYear();
  }

  /**
   * Gets or sets the day of the week relative to the configured first day of the week
   * (0 = first day of the week … 6 = last day), in the configured timezone.
   *
   * Unlike {@link DateTick.day}, which is always Sunday-based, this respects `weekStartsOn`.
   *
   * @param {number} [value] - The relative day of the week to set
   * @returns {number | DateTick} The relative day of the week, or a new DateTick when setting
   * @memberof DateTick
   */
  public weekday(): number;
  public weekday(value: number): DateTick;
  public weekday(value?: number): number | DateTick {
    const p = this.parts();
    const relative = (p.weekday - this._weekStartsOn + 7) % 7;
    if (value == null) return relative;
    return this.rebuild({ day: p.day - relative + value });
  }

  /** Plural getter alias of {@link DateTick.week} (weeks have no setter). */
  public weeks(): number {
    return this.week();
  }

  /**
   * Gets the number of weeks in the year (in the configured timezone)
   *
   * @returns {number} The number of weeks
   * @memberof DateTick
   */
  public weeksInYear(): number {
    return this.weeksInYearBy((t) => t.week());
  }

  /**
   * Returns a new DateTick instance with the given date, keeping the current locale and timezone
   *
   * @param {Date | string} date - The date to wrap
   * @returns {DateTick} The new DateTick
   * @memberof DateTick
   */
  public withDate(date: DateInput): DateTick {
    return new DateTick(this._locale, this._timezone, date, this._weekStartsOn, this._ordinal);
  }

  /**
   * Returns a new DateTick instance with the given locale, keeping the current instant and timezone
   *
   * @param {string} locale - The BCP 47 locale
   * @returns {DateTick} The new DateTick
   * @memberof DateTick
   */
  public withLocale(locale: string): DateTick {
    return new DateTick(locale, this._timezone, this._date, this._weekStartsOn, this._ordinal);
  }

  /**
   * Returns a new DateTick instance with the given timezone, keeping the same absolute instant
   * (the wall-clock components will be re-interpreted in the new zone)
   *
   * @param {string} timezone - The IANA timezone
   * @returns {DateTick} The new DateTick
   * @memberof DateTick
   */
  public withTimezone(timezone: string): DateTick {
    return new DateTick(this._locale, timezone, this._date, this._weekStartsOn, this._ordinal);
  }

  /**
   * Returns a new DateTick instance with the given first-day-of-week, keeping everything else
   *
   * @param {number} weekStartsOn - First day of the week (0 = Sunday … 6 = Saturday)
   * @returns {DateTick} The new DateTick
   * @memberof DateTick
   */
  public withWeekStart(weekStartsOn: number): DateTick {
    return new DateTick(this._locale, this._timezone, this._date, weekStartsOn, this._ordinal);
  }

  /**
   * Gets or sets the year (in the configured timezone)
   *
   * When setting, the day is clamped to the last valid day of the target month instead of
   * overflowing (Feb 29 -> non-leap year -> Feb 28), matching {@link DateTick.add}.
   *
   * @param {number} [value] - The year to set
   * @returns {number | DateTick} The year, or a new DateTick when setting
   * @memberof DateTick
   */
  public year(): number;
  public year(value: number): DateTick;
  public year(value?: number): number | DateTick {
    if (value == null) return this.parts().year;
    const p = this.parts();
    // Clamp the day to the last valid day of the target year's month so Feb 29 in a leap year
    // resolves to Feb 28 in a non-leap year rather than overflowing to Mar 1.
    const targetDay = Math.min(p.day, getDaysInMonth(value, p.month));
    return this.rebuild({ year: value, day: targetDay });
  }

  /** Plural alias of {@link DateTick.year}. */
  public years(): number;
  public years(value: number): DateTick;
  public years(value?: number): number | DateTick {
    return value == null ? this.year() : this.year(value);
  }

  /**
   * Adds calendar months (used for month/quarter/year), clamping the day to the last valid day.
   */
  private addMonths(months: number): DateTick {
    const p = this.parts();
    const totalMonths = p.year * 12 + p.month + months;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const targetDay = Math.min(p.day, getDaysInMonth(targetYear, targetMonth));
    return this.rebuild({ year: targetYear, month: targetMonth, day: targetDay });
  }

  private calendarDayNumber(): number {
    const p = this.parts();
    return Math.floor(utcDateFromYMD(p.year, p.month, p.day).getTime() / 86_400_000);
  }

  /**
   * Returns a preset Intl.DateTimeFormatOptions for a given format string.
   */
  private getPreset(format: DateFormatPreset): Intl.DateTimeFormatOptions {
    switch (format) {
      case 'short':
        return { dateStyle: 'short', timeStyle: 'short' };
      case 'medium':
        return { dateStyle: 'medium', timeStyle: 'medium' };
      case 'long':
        return { dateStyle: 'long', timeStyle: 'long' };
      case 'full':
        return { dateStyle: 'full', timeStyle: 'full' };
      case 'dateOnly':
        return { year: 'numeric', month: 'long', day: 'numeric' };
      case 'timeOnly':
        return { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      case 'weekdayTime':
        return { weekday: 'long', hour: 'numeric', minute: 'numeric' };
      case 'isoStyle12h':
        return {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        };
      case 'isoStyle24h':
        return {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        };
      default:
        return {};
    }
  }

  /**
   * The Thursday of this instant's ISO week, as a UTC date built from the zoned calendar date so the
   * math is offset-free. Shared by {@link DateTick.isoWeek} and {@link DateTick.weekYear}.
   */
  private isoThursday(): Date {
    const p = this.parts();
    const target = utcDateFromYMD(p.year, p.month, p.day);
    target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
    return target;
  }

  /**
   * Creates an adaptive live relative-time stream.
   */
  private liveRelativeTime(formatter: () => string): TimeAgoLive {
    const targetTime = this._date.getTime();
    const getRefreshInterval = (secondsDiff: number): number => {
      if (secondsDiff < 60) return 1000;
      if (secondsDiff < 3600) return 30_000;
      if (secondsDiff < 86400) return 1_800_000;
      return 3_600_000;
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const listeners = new Set<TimeAgoListener>();

    const clearTimer = (): void => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const tick = (): void => {
      const value = formatter();
      listeners.forEach((listener) => listener(value));
      // A listener may unsubscribe during notification (common when a component unmounts). If that
      // drained the set, stop here instead of scheduling a timer that would never be cleared.
      if (listeners.size === 0) return;
      const secondsDiff = Math.abs((Date.now() - targetTime) / 1000);
      timeoutId = setTimeout(tick, getRefreshInterval(secondsDiff));
    };

    return {
      subscribe: (listener: TimeAgoListener): (() => void) => {
        listeners.add(listener);
        if (listeners.size === 1) {
          tick();
        } else {
          listener(formatter());
        }

        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) clearTimer();
        };
      },
      unsubscribe: (): void => {
        listeners.clear();
        clearTimer();
      },
    };
  }

  /**
   * Formats the timezone's current offset from UTC as ±HH:mm (with colon) or ±HHmm (without).
   */
  private offsetString(colon: boolean): string {
    const offsetMinutes = offsetMs(this._date, this._timezone) / 60_000;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(Math.round(abs % 60)).padStart(2, '0');
    return colon ? `${sign}${hh}:${mm}` : `${sign}${hh}${mm}`;
  }

  /**
   * Applies the configured ordinal override, falling back to the English suffix.
   */
  private ordinalFor(n: number): string {
    return this._ordinal ? this._ordinal(n) : `${n}${ordinalSuffix(n)}`;
  }

  /**
   * Reads the wrapped instant's wall-clock components in the configured timezone.
   */
  private parts(): ZonedParts {
    return partsOf(this._date, this._timezone);
  }

  /**
   * Floating-point calendar-unit difference (used by `diff` when `precise` is true).
   *
   * Computes the whole-unit count, then interpolates the fractional remainder between the
   * instant `whole` units away from `other` and the next unit boundary in the direction of `this`.
   */
  private preciseCalendarDiff(other: Date, unitMonths: number): number {
    const whole = this.wholeMonthDiff(other, unitMonths);
    const otherDateTick = this.withDate(other);
    const anchor = otherDateTick.add(whole * unitMonths, 'month');
    const step = this._date.getTime() >= anchor.valueOf() ? 1 : -1;
    const nextAnchor = otherDateTick.add((whole + step) * unitMonths, 'month');
    const span = nextAnchor.valueOf() - anchor.valueOf();
    const progress = span === 0 ? 0 : (this._date.getTime() - anchor.valueOf()) / span;
    return whole + progress * step;
  }

  /**
   * Returns a new DateTick built from the current zoned components with the given overrides applied,
   * then converted back to an absolute instant in the configured timezone.
   */
  private rebuild(overrides: Partial<Omit<ZonedParts, 'weekday'>>): DateTick {
    if (!this.isValid()) throw new Error(`Invalid date: ${this._date}`);
    const merged = { ...this.parts(), ...overrides };
    return this.withDate(instantFromParts(merged, this._timezone));
  }

  /**
   * Normalizes a DateInput (Date, string, or DateTick) to a plain Date
   */
  private toComparable(value: DateInput): Date {
    return value instanceof DateTick ? value.toDate() : this.validateDate(value);
  }

  /**
   * Validates a date and throws an error if invalid
   */
  private validateDate(date: DateInput): Date {
    if (!DateTick.isValid(date)) {
      throw new Error(`Invalid date: ${date}`);
    }
    return DateTick.resolveInput(date, this._timezone);
  }

  /**
   * Number of weeks in this instant's year, per the given week-numbering function: Dec 31 usually
   * carries the highest week number, unless it rolls into week 1 of the next year (then Dec 24 does).
   * Shared by {@link DateTick.weeksInYear} and {@link DateTick.isoWeeksInYear}.
   */
  private weeksInYearBy(weekOf: (t: DateTick) => number): number {
    const week = weekOf(this.rebuild({ month: 11, day: 31 }));
    return week === 1 ? weekOf(this.rebuild({ month: 11, day: 31 - 7 })) : week;
  }

  /**
   * Whole calendar-month difference (in units of `unitMonths` months), truncated toward zero.
   *
   * The year/month field difference alone over-counts by one when the end date has not yet reached
   * the start's day-of-month and time within the final month (e.g. Jan 15 -> Feb 14 is 0 whole
   * months, not 1; a birthday one day away is 0 whole years). So the final, incomplete month is
   * dropped by comparing the day-and-time position within the anchor month.
   */
  private wholeMonthDiff(other: Date, unitMonths: number): number {
    const end = this.parts();
    const start = partsOf(other, this._timezone);
    let months = (end.year - start.year) * 12 + (end.month - start.month);
    // Position within a month as milliseconds-since-the-1st, so day and time compare together. The
    // start's day is clamped to the anchor month's length (Jan 31 -> Feb has no 31st).
    const positionInMonth = (day: number, p: ZonedParts): number =>
      day * 86_400_000 + p.hour * 3_600_000 + p.minute * 60_000 + p.second * 1000 + p.millisecond;
    const anchorDay = Math.min(start.day, getDaysInMonth(end.year, end.month));
    const remainder = positionInMonth(end.day, end) - positionInMonth(anchorDay, start);
    if (months > 0 && remainder < 0) months -= 1;
    else if (months < 0 && remainder > 0) months += 1;
    return Math.trunc(months / unitMonths);
  }
}
