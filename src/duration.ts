import { tokenize } from './internal';
import type { DateUnit, DurationInput } from './types';

/**
 * Fixed unit ratios in milliseconds (1 month = 30 days, 1 year = 365 days), the same approximation
 * used by `DateTick.timeAgo`.
 */
const RATIOS: Record<DateUnit, number> = {
  millisecond: 1,
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  date: 86_400_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30 days
  quarter: 7_776_000_000, // 90 days
  year: 31_536_000_000, // 365 days
};

const ratioFor = (unit: DateUnit): number => {
  const ratio = RATIOS[unit];
  if (ratio == null) throw new Error(`Invalid duration unit: ${unit}`);
  return ratio;
};

// Duration format tokens, ordered longest-first so the greedy matcher prefers e.g. `YYYY` over `YY`.
const FORMAT_TOKENS = ['YYYY', 'SSS', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss', 'Y', 'M', 'D', 'H', 'm', 's'];

// ISO 8601 duration: an optional sign, `P`, the date part (`Y`/`M`/`W`/`D`) and an optional `T` time
// part (`H`/`M`/`S`). Each amount may be fractional with `.` or `,`.
const ISO_DURATION =
  /^([+-])?P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/;

/**
 * Parses an ISO 8601 duration string (e.g. 'P1Y2M10DT2H30M') into milliseconds, using the same fixed
 * unit ratios as the rest of the class (1 month = 30 days, 1 year = 365 days).
 */
const msFromISODuration = (input: string): number => {
  const m = ISO_DURATION.exec(input.trim());
  // Reject `P`/`PT` with no components (m[1] is the sign; m[2..8] are the amounts).
  if (!m || !m.slice(2).some(Boolean)) throw new Error(`Invalid ISO 8601 duration: "${input}"`);
  const num = (value: string | undefined): number => (value ? Number.parseFloat(value.replace(',', '.')) : 0);
  const ms =
    num(m[2]) * RATIOS.year +
    num(m[3]) * RATIOS.month +
    num(m[4]) * RATIOS.week +
    num(m[5]) * RATIOS.day +
    num(m[6]) * RATIOS.hour +
    num(m[7]) * RATIOS.minute +
    num(m[8]) * RATIOS.second;
  return m[1] === '-' ? -ms : ms;
};

/**
 * An immutable length of time, independent of any particular instant.
 *
 * Conversions use fixed ratios (1 month = 30 days, 1 year = 365 days). `humanize()` is locale-aware via `Intl`.
 *
 * @class Duration
 */
export class Duration {
  private readonly _locale: string;
  private readonly _ms: number;

  /**
   * Creates a Duration.
   *
   * @param {number | string | DurationInput} value - A millisecond amount, an amount paired with `unit`,
   * an ISO 8601 duration string (e.g. 'P1Y2M10DT2H30M'), or a components object
   * @param {DateUnit} [unit] - The unit when `value` is a number (defaults to milliseconds)
   * @param {string} [locale='en'] - The locale used by `humanize()`
   * @throws {Error} If `value` is a string that is not a valid ISO 8601 duration
   * @memberof Duration
   */
  constructor(value: number | string | DurationInput, unit?: DateUnit, locale: string = 'en') {
    this._locale = locale;
    if (typeof value === 'string') {
      this._ms = msFromISODuration(value);
    } else if (typeof value === 'number') {
      this._ms = value * (unit ? ratioFor(unit) : 1);
    } else if (value instanceof Duration) {
      this._ms = value.valueOf();
    } else if (value && typeof value === 'object') {
      this._ms =
        (value.years ?? 0) * RATIOS.year +
        (value.months ?? 0) * RATIOS.month +
        (value.weeks ?? 0) * RATIOS.week +
        (value.days ?? 0) * RATIOS.day +
        (value.hours ?? 0) * RATIOS.hour +
        (value.minutes ?? 0) * RATIOS.minute +
        (value.seconds ?? 0) * RATIOS.second +
        (value.milliseconds ?? 0);
    } else {
      this._ms = 0;
    }
  }

  /**
   * Checks whether a value is a Duration instance.
   *
   * @param {unknown} value - The value to check
   * @returns {boolean} True if the value is a Duration
   * @memberof Duration
   */
  public static isDuration(value: unknown): value is Duration {
    return value instanceof Duration;
  }

  /**
   * Returns a new Duration with the given amount added
   *
   * @param {number} value - The amount to add
   * @param {DateUnit} [unit='millisecond'] - The unit of the amount
   * @returns {Duration} The new Duration
   * @memberof Duration
   */
  public add(value: number, unit: DateUnit = 'millisecond'): Duration {
    return new Duration(this._ms + value * ratioFor(unit), undefined, this._locale);
  }

  /**
   * The whole duration expressed in a chosen unit.
   *
   * @param {DateUnit} unit - The target unit
   * @returns {number} The duration in that unit
   * @memberof Duration
   */
  public as(unit: DateUnit): number {
    return this._ms / ratioFor(unit);
  }

  /**
   * The whole duration expressed in days (fractional)
   *
   * @returns {number} The duration in days
   * @memberof Duration
   */
  public asDays(): number {
    return this._ms / RATIOS.day;
  }

  /**
   * The whole duration expressed in hours (fractional)
   *
   * @returns {number} The duration in hours
   * @memberof Duration
   */
  public asHours(): number {
    return this._ms / RATIOS.hour;
  }

  /**
   * The whole duration expressed in milliseconds
   *
   * @returns {number} The duration in milliseconds
   * @memberof Duration
   */
  public asMilliseconds(): number {
    return this._ms;
  }

  /**
   * The whole duration expressed in minutes (fractional)
   *
   * @returns {number} The duration in minutes
   * @memberof Duration
   */
  public asMinutes(): number {
    return this._ms / RATIOS.minute;
  }

  /**
   * The whole duration expressed in months (fractional, 1 month = 30 days)
   *
   * @returns {number} The duration in months
   * @memberof Duration
   */
  public asMonths(): number {
    return this._ms / RATIOS.month;
  }

  /**
   * The whole duration expressed in seconds (fractional)
   *
   * @returns {number} The duration in seconds
   * @memberof Duration
   */
  public asSeconds(): number {
    return this._ms / RATIOS.second;
  }

  /**
   * The whole duration expressed in weeks (fractional)
   *
   * @returns {number} The duration in weeks
   * @memberof Duration
   */
  public asWeeks(): number {
    return this._ms / RATIOS.week;
  }

  /**
   * The whole duration expressed in years (fractional, 1 year = 365 days)
   *
   * @returns {number} The duration in years
   * @memberof Duration
   */
  public asYears(): number {
    return this._ms / RATIOS.year;
  }

  /**
   * The days component after extracting whole years and months
   *
   * @returns {number} The days component
   * @memberof Duration
   */
  public days(): number {
    return this.components().days;
  }

  /**
   * Formats the duration with token patterns.
   *
   * Supported tokens: `Y` `YY` `YYYY` `M` `MM` `D` `DD` `H` `HH` `m` `mm` `s` `ss` `SSS`.
   * Wrap literal text in `[square brackets]`.
   *
   * @param {string} [pattern='HH:mm:ss'] - The token pattern
   * @returns {string} The formatted duration
   * @memberof Duration
   */
  public format(pattern: string = 'HH:mm:ss'): string {
    const sign = this._ms < 0 ? '-' : '';
    const c = this.absComponents();
    const two = (n: number): string => String(n).padStart(2, '0');
    const map: Record<string, string> = {
      YYYY: String(c.years).padStart(4, '0'),
      YY: two(c.years % 100),
      Y: String(c.years),
      MM: two(c.months),
      M: String(c.months),
      DD: two(c.days),
      D: String(c.days),
      HH: two(c.hours),
      H: String(c.hours),
      mm: two(c.minutes),
      m: String(c.minutes),
      ss: two(c.seconds),
      s: String(c.seconds),
      SSS: String(c.milliseconds).padStart(3, '0'),
    };
    const out = tokenize(pattern, FORMAT_TOKENS)
      .map((segment) => {
        if (segment.startsWith('[') && segment.endsWith(']')) return segment.slice(1, -1);
        return segment in map ? map[segment] : segment;
      })
      .join('');
    return sign + out;
  }

  /**
   * Returns the duration component for a unit.
   *
   * @param {DateUnit} unit - The component unit
   * @returns {number} The component value
   * @memberof Duration
   */
  public get(unit: DateUnit): number {
    const c = this.components();
    switch (unit) {
      case 'year':
        return c.years;
      case 'quarter':
        return Math.trunc(c.months / 3);
      case 'month':
        return c.months;
      case 'week':
        return Math.trunc(c.days / 7);
      case 'date':
      case 'day':
        return c.days;
      case 'hour':
        return c.hours;
      case 'minute':
        return c.minutes;
      case 'second':
        return c.seconds;
      case 'millisecond':
        return c.milliseconds;
      default:
        throw new Error(`Invalid duration unit: ${unit}`);
    }
  }

  /**
   * The hours component
   *
   * @returns {number} The hours component
   * @memberof Duration
   */
  public hours(): number {
    return this.components().hours;
  }

  /**
   * Returns a human-readable, locale-aware string for the duration (e.g. '2 days', 'in 2 days')
   *
   * @param {boolean} [withSuffix=false] - Include a relative suffix (past/future) based on the sign
   * @returns {string} The humanized string
   * @memberof Duration
   */
  public humanize(withSuffix: boolean = false): string {
    const abs = Math.abs(this._ms);
    const seconds = abs / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;
    let unit: Intl.RelativeTimeFormatUnit;
    let value: number;
    if (seconds < 45) {
      unit = 'second';
      value = Math.round(seconds);
    } else if (minutes < 45) {
      unit = 'minute';
      value = Math.round(minutes);
    } else if (hours < 22) {
      unit = 'hour';
      value = Math.round(hours);
    } else if (days < 26) {
      unit = 'day';
      value = Math.round(days);
    } else if (days / 30 < 11) {
      unit = 'month';
      value = Math.round(days / 30);
    } else {
      unit = 'year';
      value = Math.round(days / 365);
    }
    if (withSuffix) {
      const signed = this._ms < 0 ? -value : value;
      return new Intl.RelativeTimeFormat(this._locale, { numeric: 'auto' }).format(signed, unit);
    }
    return new Intl.NumberFormat(this._locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
  }

  /**
   * The milliseconds component
   *
   * @returns {number} The milliseconds component
   * @memberof Duration
   */
  public milliseconds(): number {
    return this.components().milliseconds;
  }

  /**
   * The minutes component
   *
   * @returns {number} The minutes component
   * @memberof Duration
   */
  public minutes(): number {
    return this.components().minutes;
  }

  /**
   * The months component after extracting whole years
   *
   * @returns {number} The months component
   * @memberof Duration
   */
  public months(): number {
    return this.components().months;
  }

  /**
   * The seconds component
   *
   * @returns {number} The seconds component
   * @memberof Duration
   */
  public seconds(): number {
    return this.components().seconds;
  }

  /**
   * Returns a new Duration with the given amount subtracted
   *
   * @param {number} value - The amount to subtract
   * @param {DateUnit} [unit='millisecond'] - The unit of the amount
   * @returns {Duration} The new Duration
   * @memberof Duration
   */
  public subtract(value: number, unit: DateUnit = 'millisecond'): Duration {
    return this.add(-value, unit);
  }

  /**
   * Returns the ISO 8601 duration representation (e.g. 'P1Y2M3DT4H5M6S')
   *
   * @returns {string} The ISO 8601 duration string
   * @memberof Duration
   */
  public toISOString(): string {
    const c = this.components();
    const sign = this._ms < 0 ? '-' : '';
    const part = (value: number, suffix: string): string => (value ? `${Math.abs(value)}${suffix}` : '');
    const date = `${part(c.years, 'Y')}${part(c.months, 'M')}${part(c.days, 'D')}`;
    const seconds = Math.abs(c.seconds) + Math.abs(c.milliseconds) / 1000;
    const time = `${part(c.hours, 'H')}${part(c.minutes, 'M')}${seconds ? `${seconds}S` : ''}`;
    if (!date && !time) return 'P0D';
    return `${sign}P${date}${time ? `T${time}` : ''}`;
  }

  /**
   * Serializes the duration as its ISO 8601 string (so `JSON.stringify` works)
   *
   * @returns {string} The ISO 8601 duration string
   * @memberof Duration
   */
  public toJSON(): string {
    return this.toISOString();
  }

  /**
   * The total duration in milliseconds (enables numeric coercion, e.g. `+duration`)
   *
   * @returns {number} The duration in milliseconds
   * @memberof Duration
   */
  public valueOf(): number {
    return this._ms;
  }

  /**
   * The years component
   *
   * @returns {number} The years component
   * @memberof Duration
   */
  public years(): number {
    return this.components().years;
  }

  private absComponents(): Required<DurationInput> {
    const c = this.components();
    return {
      years: Math.abs(c.years),
      months: Math.abs(c.months),
      weeks: Math.abs(c.weeks),
      days: Math.abs(c.days),
      hours: Math.abs(c.hours),
      minutes: Math.abs(c.minutes),
      seconds: Math.abs(c.seconds),
      milliseconds: Math.abs(c.milliseconds),
    };
  }

  /**
   * Decomposes the absolute duration into signed calendar components (years → milliseconds).
   */
  private components(): Required<DurationInput> {
    const sign = this._ms < 0 ? -1 : 1;
    let rem = Math.abs(this._ms);
    const years = Math.floor(rem / RATIOS.year);
    rem -= years * RATIOS.year;
    const months = Math.floor(rem / RATIOS.month);
    rem -= months * RATIOS.month;
    const days = Math.floor(rem / RATIOS.day);
    rem -= days * RATIOS.day;
    const hours = Math.floor(rem / RATIOS.hour);
    rem -= hours * RATIOS.hour;
    const minutes = Math.floor(rem / RATIOS.minute);
    rem -= minutes * RATIOS.minute;
    const seconds = Math.floor(rem / RATIOS.second);
    rem -= seconds * RATIOS.second;
    return {
      years: years * sign,
      months: months * sign,
      weeks: 0,
      days: days * sign,
      hours: hours * sign,
      minutes: minutes * sign,
      seconds: seconds * sign,
      milliseconds: rem * sign,
    };
  }
}
