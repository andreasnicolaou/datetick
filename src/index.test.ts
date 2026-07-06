/* eslint-disable @typescript-eslint/no-explicit-any -- tests intentionally use `any` to exercise untyped/invalid-input paths */
import datetick, { DateTick, Duration } from './index';

describe('DateTick', () => {
  describe('construction', () => {
    it('should create with locale and timezone', () => {
      const dt = new DateTick('en', 'UTC');
      expect(dt).toBeInstanceOf(DateTick);
    });

    it('should default to now when no date is provided', () => {
      const before = Date.now();
      const dt = new DateTick('en', 'UTC');
      const after = Date.now();
      expect(dt.valueOf()).toBeGreaterThanOrEqual(before);
      expect(dt.valueOf()).toBeLessThanOrEqual(after);
    });

    it('should accept a string date', () => {
      const dt = new DateTick('en', 'UTC', '2020-01-02T03:04:05.006Z');
      expect(dt.toISOString()).toBe('2020-01-02T03:04:05.006Z');
    });

    it('should accept date parts objects and arrays as zoned wall-clock input', () => {
      const fromObject = new DateTick('en', 'Asia/Nicosia', {
        year: 2026,
        month: 5,
        date: 26,
        hour: 9,
        minute: 24,
      });
      const fromArray = new DateTick('en', 'Asia/Nicosia', [2026, 5, 26, 9, 24]);
      expect(fromObject.toISOString()).toBe('2026-06-26T06:24:00.000Z');
      expect(fromArray.toISOString()).toBe('2026-06-26T06:24:00.000Z');
    });

    it('should clone a Date defensively so external mutation does not leak in', () => {
      const source = new Date('2020-01-01T00:00:00Z');
      const dt = new DateTick('en', 'UTC', source);
      source.setFullYear(1999);
      expect(dt.toDate().getUTCFullYear()).toBe(2020);
    });

    it('should expose locale and timezone', () => {
      const dt = new DateTick('fr', 'Europe/Paris', '2020-01-01T00:00:00Z');
      expect(dt.locale()).toBe('fr');
      expect(dt.timezone()).toBe('Europe/Paris');
    });
  });

  describe('immutability', () => {
    it('should not mutate the original instance when setting', () => {
      const dt = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      const next = dt.year(2025);
      expect(dt.year()).toBe(2020);
      expect(next.year()).toBe(2025);
      expect(next).not.toBe(dt);
    });

    it('clone should return an equal but distinct instance', () => {
      const dt = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      const c = dt.clone();
      expect(c).not.toBe(dt);
      expect(c.valueOf()).toBe(dt.valueOf());
    });
  });

  describe('getters and setters', () => {
    let dt: DateTick;

    beforeEach(() => {
      // Construct from an explicit UTC instant so the test is host-timezone independent
      dt = new DateTick('en', 'UTC', '2020-01-02T03:04:05.006Z');
    });

    it('should get local date parts', () => {
      expect(dt.year()).toBe(2020);
      expect(dt.month()).toBe(0);
      expect(dt.date()).toBe(2);
      expect(dt.hour()).toBe(3);
      expect(dt.minute()).toBe(4);
      expect(dt.second()).toBe(5);
      expect(dt.millisecond()).toBe(6);
    });

    it('should set each unit immutably', () => {
      expect(dt.year(2021).year()).toBe(2021);
      expect(dt.month(5).month()).toBe(5);
      expect(dt.date(10).date()).toBe(10);
      expect(dt.hour(9).hour()).toBe(9);
      expect(dt.minute(30).minute()).toBe(30);
      expect(dt.second(45).second()).toBe(45);
      expect(dt.millisecond(123).millisecond()).toBe(123);
    });

    it('exposes plural get/set aliases', () => {
      // Getters mirror the singular accessors.
      expect(dt.years()).toBe(dt.year());
      expect(dt.months()).toBe(dt.month());
      expect(dt.dates()).toBe(dt.date());
      expect(dt.days()).toBe(dt.day());
      expect(dt.hours()).toBe(dt.hour());
      expect(dt.minutes()).toBe(dt.minute());
      expect(dt.seconds()).toBe(dt.second());
      expect(dt.milliseconds()).toBe(dt.millisecond());
      expect(dt.weeks()).toBe(dt.week());
      // Setters return a new DateTick, just like the singular form.
      expect(dt.years(2021).year()).toBe(2021);
      expect(dt.dates(10).date()).toBe(10);
      expect(dt.hours(9).hour()).toBe(9);
    });

    it('should get and set day of week', () => {
      const wednesday = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z'); // a Wednesday
      expect(wednesday.day()).toBe(3);
      const monday = wednesday.day(1);
      expect(monday.day()).toBe(1);
    });
  });

  describe('get() / set()', () => {
    let dt: DateTick;

    beforeEach(() => {
      dt = new DateTick('en', 'UTC', '2020-03-15T10:30:45.123Z');
    });

    it('should get values via get()', () => {
      expect(dt.get('year')).toBe(2020);
      expect(dt.get('month')).toBe(2);
      expect(dt.get('date')).toBe(15);
      expect(dt.get('day')).toBe(0); // 2020-03-15 is a Sunday
      expect(dt.get('hour')).toBe(10);
      expect(dt.get('minute')).toBe(30);
      expect(dt.get('second')).toBe(45);
      expect(dt.get('millisecond')).toBe(123);
      expect(dt.get('quarter')).toBe(1);
      expect(dt.get('dayOfYear')).toBeGreaterThan(0);
      expect(dt.get('week')).toBeGreaterThan(0);
      expect(dt.get('isoWeek')).toBeGreaterThan(0);
      expect(dt.get('isoDay')).toBeGreaterThan(0);
      expect(dt.get('isoWeekYear')).toBe(2020);
      expect(dt.get('isoWeeksInYear')).toBeGreaterThan(0);
      expect(dt.get('weekYear')).toBe(2020);
      expect(dt.get('weekday')).toBeGreaterThanOrEqual(0);
      expect(dt.get('weeksInYear')).toBeGreaterThan(0);
      expect(dt.get('daysInMonth')).toBe(31);
    });

    it('should set values via set()', () => {
      expect(dt.set('year', 2025).year()).toBe(2025);
      expect(dt.set('month', 11).month()).toBe(11);
      expect(dt.set('quarter', 3).quarter()).toBe(3);
      expect(dt.set('date', 1).date()).toBe(1);
      expect(dt.set('day', 0).day()).toBe(0); // snap to Sunday of the current week
      expect(dt.set('hour', 0).hour()).toBe(0);
      expect(dt.set('minute', 0).minute()).toBe(0);
      expect(dt.set('second', 0).second()).toBe(0);
      expect(dt.set('millisecond', 0).millisecond()).toBe(0);
    });

    it('should throw on invalid unit for set()', () => {
      expect(() => dt.set('week', 1)).toThrow(/Invalid unit/);
    });

    it('clamps the day when setting month/quarter/year instead of overflowing (matches add())', () => {
      const mar31 = new DateTick('en', 'UTC', '2021-03-31T00:00:00Z');
      // Mar 31 -> February must clamp to the 28th, not roll over to Mar 3.
      expect(mar31.set('month', 1).formatPattern('YYYY-MM-DD')).toBe('2021-02-28');
      expect(mar31.month(1).formatPattern('YYYY-MM-DD')).toBe('2021-02-28');
      // May 31 (2nd month of Q2) moved to Q1 becomes the 2nd month of Q1 (Feb) and clamps.
      const may31 = new DateTick('en', 'UTC', '2021-05-31T00:00:00Z');
      expect(may31.set('quarter', 1).formatPattern('YYYY-MM-DD')).toBe('2021-02-28');
      // Leap-day Feb 29 into a non-leap year clamps to Feb 28.
      const feb29 = new DateTick('en', 'UTC', '2020-02-29T00:00:00Z');
      expect(feb29.set('year', 2021).formatPattern('YYYY-MM-DD')).toBe('2021-02-28');
      expect(feb29.year(2021).formatPattern('YYYY-MM-DD')).toBe('2021-02-28');
      // Leap target keeps Feb 29.
      expect(feb29.set('year', 2024).formatPattern('YYYY-MM-DD')).toBe('2024-02-29');
    });

    it('sets low years (0-99) literally instead of mapping them to 1900-1999', () => {
      const d = new DateTick('en', 'UTC', '2021-06-15T00:00:00Z');
      expect(d.year(99).formatPattern('YYYY-MM-DD')).toBe('0099-06-15');
      expect(d.year(5).year()).toBe(5);
    });

    it('returns NaN for unknown get units from untyped callers', () => {
      expect(Number.isNaN(dt.get('fortnight' as any))).toBe(true);
    });
  });

  describe('weekday()', () => {
    it('is relative to the configured first day of the week, unlike day()', () => {
      // 2026-06-25 is a Thursday
      const sundayStart = new DateTick('en', 'UTC', '2026-06-25T00:00:00Z');
      expect(sundayStart.day()).toBe(4);
      expect(sundayStart.weekday()).toBe(4); // Sunday-start: weekday() matches day()

      const mondayStart = sundayStart.withWeekStart(1);
      expect(mondayStart.day()).toBe(4); // unaffected by week start
      expect(mondayStart.weekday()).toBe(3); // Monday-start: Thursday is the 4th day, offset 3
    });

    it('sets the date to the requested relative weekday', () => {
      const mondayStart = new DateTick('en', 'UTC', '2026-06-25T00:00:00Z').withWeekStart(1); // Thursday
      expect(mondayStart.weekday(0).formatPattern('ddd YYYY-MM-DD')).toBe('Mon 2026-06-22');
      expect(mondayStart.weekday(6).formatPattern('ddd YYYY-MM-DD')).toBe('Sun 2026-06-28');
    });
  });

  describe('quarter() and dayOfYear() setters', () => {
    it('quarter(value) preserves the month offset within the quarter', () => {
      const feb = new DateTick('en', 'UTC', '2026-02-15T00:00:00Z'); // Q1, month offset 1
      expect(feb.quarter()).toBe(1);
      const q3 = feb.quarter(3);
      expect(q3.quarter()).toBe(3);
      expect(q3.month()).toBe(7); // August: same offset (1) within Q3 (months 6,7,8)
      expect(q3.date()).toBe(15);
    });

    it('dayOfYear(value) sets the day of the year, rolling into later months/years like native Date', () => {
      const jan1 = new DateTick('en', 'UTC', '2026-01-01T00:00:00Z');
      const day200 = jan1.dayOfYear(200);
      expect(day200.dayOfYear()).toBe(200);
      expect(day200.formatPattern('YYYY-MM-DD')).toBe('2026-07-19');
    });
  });

  describe('add / subtract', () => {
    let dt: DateTick;

    beforeEach(() => {
      dt = new DateTick('en', 'UTC', '2020-01-15T12:00:00.000Z');
    });

    it('should add simple time units', () => {
      expect(dt.add(1000, 'millisecond').toISOString()).toBe('2020-01-15T12:00:01.000Z');
      expect(dt.add(30, 'second').toISOString()).toBe('2020-01-15T12:00:30.000Z');
      expect(dt.add(15, 'minute').toISOString()).toBe('2020-01-15T12:15:00.000Z');
      expect(dt.add(2, 'hour').toISOString()).toBe('2020-01-15T14:00:00.000Z');
    });

    it('should add weeks', () => {
      expect(dt.add(1, 'week').toISOString()).toBe('2020-01-22T12:00:00.000Z');
    });

    it('should subtract as the inverse of add', () => {
      expect(dt.add(5, 'day').subtract(5, 'day').valueOf()).toBe(dt.valueOf());
    });

    it('should clamp month overflow (Jan 31 + 1 month -> Feb, not Mar)', () => {
      const jan31 = new DateTick('en', 'UTC', '2021-01-31T00:00:00Z');
      const result = jan31.add(1, 'month');
      expect(result.month()).toBe(1); // February
      expect(result.date()).toBe(28); // 2021 is not a leap year
    });

    it('should land on Feb 29 in a leap year', () => {
      const jan31 = new DateTick('en', 'UTC', '2020-01-31T00:00:00Z');
      const result = jan31.add(1, 'month');
      expect(result.month()).toBe(1);
      expect(result.date()).toBe(29);
    });

    it('should add quarters', () => {
      const q = new DateTick('en', 'UTC', '2020-01-15T00:00:00Z');
      expect(q.add(1, 'quarter').month()).toBe(3); // April
    });

    it('should clamp year overflow for Feb 29', () => {
      const feb29 = new DateTick('en', 'UTC', '2020-02-29T00:00:00Z');
      const result = feb29.add(1, 'year');
      expect(result.month()).toBe(1);
      expect(result.date()).toBe(28); // 2021 has no Feb 29
    });

    it('returns a clone for unknown units from untyped callers', () => {
      const result = dt.add(1, 'fortnight' as any);
      expect(result).not.toBe(dt);
      expect(result.valueOf()).toBe(dt.valueOf());
    });
  });

  describe('diff', () => {
    it('should compute differences in various units', () => {
      const a = new DateTick('en', 'UTC', '2020-03-15T00:00:00Z');
      const b = '2020-01-15T00:00:00Z';
      expect(a.diff(b, 'month')).toBe(2);
      expect(a.diff(b, 'day')).toBe(60);
      expect(a.diff(b, 'millisecond')).toBe(60 * 86_400_000);
      expect(a.diff(b, 'week')).toBe(8);
      expect(a.diff(b, 'minute')).toBe(60 * 1440);
      expect(a.diff(b, 'hour')).toBe(60 * 24);
      expect(a.diff(b, 'second')).toBe(60 * 86_400);
    });

    it('should be negative when the wrapped date is earlier', () => {
      const a = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      const b = new DateTick('en', 'UTC', '2021-01-01T00:00:00Z');
      expect(a.diff(b, 'year')).toBe(-1);
    });

    it('should accept a DateTick as input', () => {
      const a = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      const b = new DateTick('en', 'UTC', '2020-01-01T01:00:00Z');
      expect(b.diff(a, 'hour')).toBe(1);
    });

    it('should default to milliseconds', () => {
      const a = new DateTick('en', 'UTC', '2020-01-01T00:00:01Z');
      const b = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      expect(a.diff(b)).toBe(1000);
    });

    it('should compute quarter diff', () => {
      const a = new DateTick('en', 'UTC', '2020-07-01T00:00:00Z');
      const b = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      expect(a.diff(b, 'quarter')).toBe(2);
    });

    it('falls back to millisecond diff for unknown units from untyped callers', () => {
      const a = new DateTick('en', 'UTC', '2020-01-01T00:00:01Z');
      expect(a.diff('2020-01-01T00:00:00Z', 'fortnight' as any)).toBe(1000);
    });

    it('should compute calendar-boundary differences separately from elapsed duration', () => {
      const selected = new DateTick('en', 'Asia/Nicosia', '2026-06-26T06:24:00Z');
      const compare = new DateTick('en', 'Asia/Nicosia', '2026-06-28T03:19:00Z');
      expect(selected.diff(compare, 'day')).toBe(-1);
      expect(selected.diffCalendar(compare, 'day')).toBe(-2);
      expect(compare.diffCalendar(selected, 'day')).toBe(2);
      expect(compare.diffCalendar(selected, 'week')).toBe(1);
      expect(new DateTick('en', 'UTC', '2020-01-01T00:00:00Z').diffCalendar('2019-12-31T23:00:00Z', 'quarter')).toBe(1);
      expect(new DateTick('en', 'UTC', '2020-03-01T00:00:00Z').diffCalendar('2020-01-31T23:00:00Z', 'month')).toBe(2);
      expect(new DateTick('en', 'UTC', '2021-01-01T00:00:00Z').diffCalendar('2019-12-31T23:00:00Z', 'year')).toBe(2);
    });

    it('returns NaN for unknown calendar diff units from untyped callers', () => {
      const dt = new DateTick('en', 'UTC', '2020-01-01');
      expect(Number.isNaN(dt.diffCalendar('2020-01-01', 'fortnight' as any))).toBe(true);
    });

    it('precise=true returns a floating-point value for fixed-duration units', () => {
      const a = new DateTick('en', 'UTC', '2020-01-01T12:00:00Z');
      const b = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      expect(a.diff(b, 'hour', true)).toBe(12);
      expect(a.diff(b, 'day', true)).toBe(0.5);
      expect(a.diff(b, 'day')).toBe(0); // truncated by default
    });

    it('precise=true interpolates a fractional month/quarter/year', () => {
      // Exactly 2 months apart -> no fractional remainder either way
      const exact = new DateTick('en', 'UTC', '2020-03-15T00:00:00Z');
      expect(exact.diff('2020-01-15T00:00:00Z', 'month', true)).toBe(2);

      // Roughly 2 months + ~16% into the next month
      const partial = new DateTick('en', 'UTC', '2020-03-20T00:00:00Z');
      const precise = partial.diff('2020-01-15T00:00:00Z', 'month', true);
      expect(precise).toBeGreaterThan(2);
      expect(precise).toBeLessThan(3);
      expect(Math.trunc(precise)).toBe(partial.diff('2020-01-15T00:00:00Z', 'month'));

      const yearPrecise = new DateTick('en', 'UTC', '2021-07-01T00:00:00Z').diff('2020-01-01T00:00:00Z', 'year', true);
      expect(yearPrecise).toBeCloseTo(1.496, 2);

      // Negative direction (this before other) interpolates the fractional remainder symmetrically.
      const negative = new DateTick('en', 'UTC', '2021-01-01T00:00:00Z').diff('2021-04-15T00:00:00Z', 'month', true);
      expect(negative).toBeLessThan(-3);
      expect(negative).toBeGreaterThan(-4);
      expect(Math.trunc(negative)).toBe(-3);
    });

    it('drops the final incomplete month/year when the end has not reached the start day-of-month', () => {
      const feb14 = new DateTick('en', 'UTC', '2021-02-14T00:00:00Z');
      const feb15 = new DateTick('en', 'UTC', '2021-02-15T00:00:00Z');
      // Jan 15 -> Feb 14 is 30 days, not a whole month; Feb 15 is exactly one month.
      expect(feb14.diff('2021-01-15T00:00:00Z', 'month')).toBe(0);
      expect(feb15.diff('2021-01-15T00:00:00Z', 'month')).toBe(1);

      // Classic age calculation: the day before the anniversary is still 0 whole years.
      const dayBeforeBirthday = new DateTick('en', 'UTC', '2021-06-14T00:00:00Z');
      const onBirthday = new DateTick('en', 'UTC', '2021-06-15T00:00:00Z');
      expect(dayBeforeBirthday.diff('2020-06-15T00:00:00Z', 'year')).toBe(0);
      expect(onBirthday.diff('2020-06-15T00:00:00Z', 'year')).toBe(1);

      // Time-of-day within the anchor day also counts toward completeness.
      // Feb 28 06:00 has not reached the 12:00 anchor time; Feb 28 12:00 has.
      expect(new DateTick('en', 'UTC', '2021-02-28T06:00:00Z').diff('2021-01-31T12:00:00Z', 'month')).toBe(0);
      expect(new DateTick('en', 'UTC', '2021-02-28T12:00:00Z').diff('2021-01-31T12:00:00Z', 'month')).toBe(1);

      // Negative direction is symmetric.
      expect(new DateTick('en', 'UTC', '2020-06-15T00:00:00Z').diff('2021-01-01T00:00:00Z', 'month')).toBe(-6);
    });
  });

  describe('comparisons', () => {
    const base = new DateTick('en', 'UTC', '2020-06-15T00:00:00Z');

    it('isAfter / isBefore', () => {
      expect(base.isAfter('2020-01-01T00:00:00Z')).toBe(true);
      expect(base.isBefore('2021-01-01T00:00:00Z')).toBe(true);
      expect(base.isAfter('2021-01-01T00:00:00Z')).toBe(false);
    });

    it('isAfter / isBefore with a unit compares at that granularity', () => {
      // Later in the same day is neither strictly after nor before at day granularity.
      expect(base.isAfter('2020-06-15T23:00:00Z', 'day')).toBe(false);
      expect(base.isBefore('2020-06-15T23:00:00Z', 'day')).toBe(false);
      // A different day/month/year resolves in the expected direction.
      expect(base.isAfter('2020-06-14T23:00:00Z', 'day')).toBe(true);
      expect(base.isBefore('2020-06-16T00:00:00Z', 'day')).toBe(true);
      expect(base.isAfter('2020-05-31T00:00:00Z', 'month')).toBe(true);
      expect(base.isBefore('2021-01-01T00:00:00Z', 'year')).toBe(true);
      // isSameOrAfter / isSameOrBefore honor the unit on both sides of the comparison.
      expect(base.isSameOrAfter('2020-06-15T23:00:00Z', 'day')).toBe(true);
      expect(base.isSameOrBefore('2020-06-15T00:00:00Z', 'day')).toBe(true);
    });

    it('isSame exact', () => {
      expect(base.isSame('2020-06-15T00:00:00Z')).toBe(true);
      expect(base.isSame('2020-06-15T00:00:01Z')).toBe(false);
    });

    it('isSame with unit', () => {
      expect(base.isSame('2020-06-30T23:59:59Z', 'month')).toBe(true);
      expect(base.isSame('2020-07-01T00:00:00Z', 'month')).toBe(false);
      expect(base.isSame('2020-12-31T00:00:00Z', 'year')).toBe(true);
    });

    it('isBetween exclusive and inclusive (boolean form)', () => {
      expect(base.isBetween('2020-01-01T00:00:00Z', '2020-12-31T00:00:00Z')).toBe(true);
      expect(base.isBetween('2020-06-15T00:00:00Z', '2020-12-31T00:00:00Z')).toBe(false);
      expect(base.isBetween('2020-06-15T00:00:00Z', '2020-12-31T00:00:00Z', true)).toBe(true);
    });

    it('isBetween supports independent per-side inclusivity', () => {
      const start = '2020-06-15T00:00:00Z';
      const end = '2020-12-31T00:00:00Z';
      // base is exactly at the start bound
      expect(base.isBetween(start, end, '()')).toBe(false);
      expect(base.isBetween(start, end, '[]')).toBe(true);
      expect(base.isBetween(start, end, '[)')).toBe(true); // start included
      expect(base.isBetween(start, end, '(]')).toBe(false); // start excluded

      const atEnd = new DateTick('en', 'UTC', end);
      expect(atEnd.isBetween(start, end, '[)')).toBe(false); // end excluded
      expect(atEnd.isBetween(start, end, '(]')).toBe(true); // end included
    });

    it('detects today, tomorrow and yesterday in the configured timezone', () => {
      const today = new DateTick('en', 'UTC', new Date());
      expect(today.isToday()).toBe(true);
      expect(today.add(1, 'day').isTomorrow()).toBe(true);
      expect(today.subtract(1, 'day').isYesterday()).toBe(true);
    });
  });

  describe('startOf / endOf', () => {
    const dt = new DateTick('en', 'UTC', '2020-06-15T13:24:35.678Z');

    it('startOf snaps down', () => {
      expect(dt.startOf('year').format('isoStyle24h')).toContain('01/01/2020');
      expect(dt.startOf('month').date()).toBe(1);
      expect(dt.startOf('day').hour()).toBe(0);
      expect(dt.startOf('hour').minute()).toBe(0);
      expect(dt.startOf('minute').second()).toBe(0);
      expect(dt.startOf('second').millisecond()).toBe(0);
    });

    it('startOf week snaps to Sunday', () => {
      const startWeek = dt.startOf('week');
      expect(startWeek.day()).toBe(0);
      expect(startWeek.hour()).toBe(0);
    });

    it('startOf quarter snaps to first month of quarter', () => {
      expect(dt.startOf('quarter').month()).toBe(3); // June -> Q2 starts in April
      expect(dt.startOf('quarter').date()).toBe(1);
    });

    it('endOf is one ms before the next unit', () => {
      const endMonth = dt.endOf('month');
      expect(endMonth.date()).toBe(30); // June has 30 days
      expect(endMonth.hour()).toBe(23);
      expect(endMonth.minute()).toBe(59);
      expect(endMonth.second()).toBe(59);
      expect(endMonth.millisecond()).toBe(999);
    });

    it('endOf year', () => {
      const endYear = dt.endOf('year');
      expect(endYear.month()).toBe(11);
      expect(endYear.date()).toBe(31);
    });

    it('endOf millisecond returns a clone', () => {
      expect(dt.endOf('millisecond').valueOf()).toBe(dt.valueOf());
    });

    it('startOf returns a clone for unknown units from untyped callers', () => {
      const start = dt.startOf('fortnight' as any);
      expect(start).not.toBe(dt);
      expect(start.valueOf()).toBe(dt.valueOf());
    });
  });

  describe('calendar helpers', () => {
    it('isLeapYear', () => {
      expect(new DateTick('en', 'UTC', '2020-01-01').isLeapYear()).toBe(true);
      expect(new DateTick('en', 'UTC', '2021-01-01').isLeapYear()).toBe(false);
      expect(new DateTick('en', 'UTC', '2000-01-01').isLeapYear()).toBe(true);
      expect(new DateTick('en', 'UTC', '1900-01-01').isLeapYear()).toBe(false);
    });

    it('daysInMonth', () => {
      expect(new DateTick('en', 'UTC', '2020-02-15T00:00:00Z').daysInMonth()).toBe(29);
      expect(new DateTick('en', 'UTC', '2021-02-15T00:00:00Z').daysInMonth()).toBe(28);
      expect(new DateTick('en', 'UTC', '2020-04-15T00:00:00Z').daysInMonth()).toBe(30);
    });

    it('quarter', () => {
      expect(new DateTick('en', 'UTC', '2020-01-15T00:00:00Z').quarter()).toBe(1);
      expect(new DateTick('en', 'UTC', '2020-12-15T00:00:00Z').quarter()).toBe(4);
    });

    it('dayOfYear, week, isoWeek, isoDay', () => {
      const d = new DateTick('en', 'UTC', '2020-03-15T00:00:00Z');
      expect(d.dayOfYear()).toBeGreaterThan(0);
      expect(d.week()).toBeGreaterThan(0);
      expect(d.isoWeek()).toBeGreaterThan(0);
      expect(d.isoDay()).toBeGreaterThanOrEqual(1);
      expect(d.isoDay()).toBeLessThanOrEqual(7);
    });

    it('isoDay returns 7 for Sunday', () => {
      const sunday = new DateTick('en', 'UTC', '2020-03-15T00:00:00Z'); // 2020-03-15 is a Sunday
      expect(sunday.isoDay()).toBe(7);
    });

    it('weekYear, weeksInYear, isoWeekYear, isoWeeksInYear', () => {
      const d = new DateTick('en', 'UTC', '2020-03-15T00:00:00Z');
      expect(d.weekYear()).toBe(2020);
      expect(d.weeksInYear()).toBeGreaterThanOrEqual(52);
      expect(d.isoWeekYear()).toBe(2020);
      expect(d.isoWeeksInYear()).toBeGreaterThanOrEqual(52);
    });
  });

  describe('static helpers', () => {
    it('isValid', () => {
      expect(DateTick.isValid('2020-01-01')).toBe(true);
      expect(DateTick.isValid([2020, 0, 1])).toBe(true);
      expect(DateTick.isValid('not-a-date')).toBe(false);
    });

    it('max / min', () => {
      const d1 = '2020-01-01T00:00:00Z';
      const d2 = '2021-01-01T00:00:00Z';
      // June 15 (not Jan 1) so resolving the object/array form via the host's local timezone
      // can never shift it across a year boundary, keeping this test host-timezone independent.
      expect(DateTick.max(d1, d2, { year: 2019, month: 5, date: 15 }).getUTCFullYear()).toBe(2021);
      expect(DateTick.min(d1, d2, [2019, 5, 15]).getUTCFullYear()).toBe(2019);
    });

    it('isDateTick', () => {
      expect(DateTick.isDateTick(new DateTick('en', 'UTC'))).toBe(true);
      expect(DateTick.isDateTick(new Date())).toBe(false);
    });

    it('guessTimezone', () => {
      expect(typeof DateTick.guessTimezone()).toBe('string');
      expect(DateTick.guessTimezone().length).toBeGreaterThan(0);
    });

    it('instance isValid', () => {
      expect(new DateTick('en', 'UTC', '2020-01-01').isValid()).toBe(true);
      expect(new DateTick('en', 'UTC', 'nope').isValid()).toBe(false);
    });
  });

  describe('formatting', () => {
    const dt = new DateTick('en', 'UTC', '2020-01-02T03:04:05.006Z');

    it('formats with presets', () => {
      (
        [
          'short',
          'medium',
          'long',
          'full',
          'dateOnly',
          'timeOnly',
          'weekdayTime',
          'isoStyle12h',
          'isoStyle24h',
        ] as const
      ).forEach((preset) => {
        expect(typeof dt.format(preset)).toBe('string');
        expect(dt.format(preset).length).toBeGreaterThan(0);
      });
    });

    it('formats with explicit options', () => {
      const result = dt.format({ year: 'numeric', month: '2-digit', day: '2-digit' });
      expect(result).toBe('01/02/2020');
    });

    it('formats with no argument', () => {
      expect(typeof dt.format()).toBe('string');
    });

    it('falls back to default Intl formatting for unknown presets from untyped callers', () => {
      expect(dt.format('compact' as any)).toBe(dt.format());
    });

    it('respects locale', () => {
      const fr = dt.withLocale('fr');
      expect(fr.format('dateOnly')).toMatch(/janvier/i);
    });
  });

  describe('token formatting (formatPattern)', () => {
    it('matches expected token output', () => {
      const d = new DateTick('en', 'UTC', '2019-01-25T00:00:00Z');
      expect(d.formatPattern('DD/MM/YYYY')).toBe('25/01/2019');
      expect(d.formatPattern('YYYY-MM-DD')).toBe('2019-01-25');
      expect(d.formatPattern('M/D/YY')).toBe('1/25/19');
    });

    it('handles names, 12h clock, meridiem and milliseconds', () => {
      const d = new DateTick('en', 'UTC', '2018-08-16T20:02:18.123Z');
      expect(d.formatPattern('dddd, MMMM D, YYYY h:mm:ss A')).toBe('Thursday, August 16, 2018 8:02:18 PM');
      expect(d.formatPattern('ddd MMM D')).toBe('Thu Aug 16');
      expect(d.formatPattern('HH:mm:ss.SSS')).toBe('20:02:18.123');
      expect(d.formatPattern('h a')).toBe('8 pm');
      expect(d.formatPattern('d')).toBe('4'); // Thursday
    });

    it('formats fractional-second tokens S and SS by truncating the 3-digit millisecond value', () => {
      const d = new DateTick('en', 'UTC', '2018-08-16T20:02:18.123Z');
      expect(d.formatPattern('ss.SS')).toBe('18.12');
      expect(d.formatPattern('ss.S')).toBe('18.1');
      // Leading zeros are preserved (90ms -> '.09' / '.0').
      const e = new DateTick('en', 'UTC', '2018-08-16T20:02:18.090Z');
      expect(e.formatPattern('ss.SSS')).toBe('18.090');
      expect(e.formatPattern('ss.SS')).toBe('18.09');
      expect(e.formatPattern('ss.S')).toBe('18.0');
    });

    it('supports [escaped] literals', () => {
      const d = new DateTick('en', 'UTC', '2019-01-25T00:00:00Z');
      expect(d.formatPattern('[YYYYescape] YYYY-MM-DD')).toBe('YYYYescape 2019-01-25');
    });

    it('treats an unclosed [ as a literal character rather than throwing', () => {
      const d = new DateTick('en', 'UTC', '2019-01-25T00:00:00Z');
      // No matching ']': the '[' falls through to the literal-character path, and the rest of
      // the string is still token-matched character-by-character (deterministic, if not pretty).
      expect(() => d.formatPattern('[unclosed')).not.toThrow();
      expect(d.formatPattern('[YYYY')).toBe('[2019');
    });

    it('emits the timezone offset (Z / ZZ) in the configured zone', () => {
      const d = new DateTick('en', 'Asia/Nicosia', '2026-06-25T19:23:00Z'); // UTC+3 in summer
      expect(d.formatPattern('Z')).toBe('+03:00');
      expect(d.formatPattern('ZZ')).toBe('+0300');
      expect(d.formatPattern('YYYY-MM-DD HH:mm')).toBe('2026-06-25 22:23');
      expect(new DateTick('en', 'UTC', '2026-06-25T19:23:00Z').formatPattern('Z')).toBe('+00:00');
    });

    it('respects locale for month/weekday names', () => {
      const d = new DateTick('fr', 'UTC', '2019-01-25T00:00:00Z');
      expect(d.formatPattern('MMMM')).toMatch(/janvier/i);
    });
  });

  describe('parsing (static parse)', () => {
    it('parses numeric patterns into the configured timezone', () => {
      expect(DateTick.parse('25/06/2026 22:23', 'DD/MM/YYYY HH:mm', 'en', 'UTC').toISOString()).toBe(
        '2026-06-25T22:23:00.000Z'
      );
      expect(DateTick.parse('2026-01-15', 'YYYY-MM-DD', 'en', 'Asia/Tokyo').toISOString()).toBe(
        '2026-01-14T15:00:00.000Z' // 2026-01-15 00:00 JST
      );
    });

    it('parses month names and 12-hour meridiem', () => {
      expect(DateTick.parse('Jun 25, 2026 10:23 PM', 'MMM D, YYYY h:mm A', 'en', 'UTC').toISOString()).toBe(
        '2026-06-25T22:23:00.000Z'
      );
      expect(DateTick.parse('January 5, 2020 12:00 am', 'MMMM D, YYYY h:mm a', 'en', 'UTC').toISOString()).toBe(
        '2020-01-05T00:00:00.000Z'
      );
    });

    it('round-trips with formatPattern', () => {
      const parsed = DateTick.parse('25/06/2026 22:23', 'DD/MM/YYYY HH:mm', 'en', 'UTC');
      expect(parsed.formatPattern('DD/MM/YYYY HH:mm')).toBe('25/06/2026 22:23');
    });

    it('parses 2-digit years and milliseconds', () => {
      const d = DateTick.parse('19-01-25 12:30:45.678', 'YY-MM-DD HH:mm:ss.SSS', 'en', 'UTC');
      expect(d.toISOString()).toBe('2019-01-25T12:30:45.678Z');
    });

    it('parses fractional-second tokens S and SS as scaled milliseconds', () => {
      // `.9` is nine tenths of a second (900ms), `.09` is 90ms — right-padded to 3 digits.
      expect(DateTick.parse('12:30:45.9', 'HH:mm:ss.S', 'en', 'UTC').millisecond()).toBe(900);
      expect(DateTick.parse('12:30:45.09', 'HH:mm:ss.SS', 'en', 'UTC').millisecond()).toBe(90);
      expect(DateTick.parse('12:30:45.99', 'HH:mm:ss.SS', 'en', 'UTC').millisecond()).toBe(990);
      expect(DateTick.parse('04:59:00.900 PM', 'hh:mm:ss.SSS A', 'en', 'UTC').millisecond()).toBe(900);
    });

    it('parses timezone offset tokens Z and ZZ, overriding the timezone argument', () => {
      // The wall-clock value is at +05:30, so the absolute instant is 06:30 UTC regardless of the
      // timezone argument passed for display.
      expect(DateTick.parse('2021-01-01 12:00 +05:30', 'YYYY-MM-DD HH:mm Z', 'en', 'UTC').toISOString()).toBe(
        '2021-01-01T06:30:00.000Z'
      );
      expect(DateTick.parse('2021-01-01 12:00 +0530', 'YYYY-MM-DD HH:mm ZZ', 'en', 'UTC').toISOString()).toBe(
        '2021-01-01T06:30:00.000Z'
      );
      // Negative offset and a literal `Z` for UTC.
      expect(DateTick.parse('2021-01-01 12:00 -08:00', 'YYYY-MM-DD HH:mm Z', 'en', 'UTC').toISOString()).toBe(
        '2021-01-01T20:00:00.000Z'
      );
      expect(DateTick.parse('2021-01-01 12:00 Z', 'YYYY-MM-DD HH:mm Z', 'en', 'UTC').toISOString()).toBe(
        '2021-01-01T12:00:00.000Z'
      );
    });

    it('parses low years (0-99) as literal years instead of mapping them to 1900-1999', () => {
      expect(DateTick.parse('0099-01-01', 'YYYY-MM-DD', 'en', 'UTC').year()).toBe(99);
      expect(DateTick.parse('0045-06-15', 'YYYY-MM-DD', 'en', 'UTC').formatPattern('YYYY-MM-DD')).toBe('0045-06-15');
    });

    it('computes weekday and ISO week correctly for low years (no Date.UTC 1900-mapping)', () => {
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const d = DateTick.parse('0099-01-01', 'YYYY-MM-DD', 'en', 'UTC');
      // day() (numeric) must agree with the Intl-rendered short weekday, not the weekday of 1999.
      expect(weekdays[d.day()]).toBe(d.formatPattern('ddd'));
      // ISO week must be a sane 1-53 value, not a huge number from a mis-based year start.
      expect(d.isoWeek()).toBeGreaterThanOrEqual(1);
      expect(d.isoWeek()).toBeLessThanOrEqual(53);
    });

    it('throws on input that does not match the pattern', () => {
      expect(() => DateTick.parse('not a date', 'YYYY-MM-DD')).toThrow(/Unable to parse/);
    });

    it('throws on unknown month names instead of falling back to January', () => {
      expect(() => DateTick.parse('NotAMonth 25, 2026', 'MMMM D, YYYY', 'en', 'UTC')).toThrow(/Unable to parse/);
    });

    it('throws on out-of-range date and time fields', () => {
      expect(() => DateTick.parse('2026-02-31', 'YYYY-MM-DD', 'en', 'UTC')).toThrow(/Unable to parse/);
      expect(() => DateTick.parse('2026-13-01', 'YYYY-MM-DD', 'en', 'UTC')).toThrow(/Unable to parse/);
      expect(() => DateTick.parse('2026-06-25 24:00', 'YYYY-MM-DD HH:mm', 'en', 'UTC')).toThrow(/Unable to parse/);
      expect(() => DateTick.parse('2026-06-25 12:60', 'YYYY-MM-DD HH:mm', 'en', 'UTC')).toThrow(/Unable to parse/);
    });
  });

  describe('ordinal & isSameOrBefore/After', () => {
    it('ordinal day-of-month', () => {
      const make = (iso: string): string => new DateTick('en', 'UTC', iso).ordinal();
      expect(make('2026-06-01T00:00:00Z')).toBe('1st');
      expect(make('2026-06-02T00:00:00Z')).toBe('2nd');
      expect(make('2026-06-03T00:00:00Z')).toBe('3rd');
      expect(make('2026-06-11T00:00:00Z')).toBe('11th');
      expect(make('2026-06-21T00:00:00Z')).toBe('21st');
      expect(make('2026-06-22T00:00:00Z')).toBe('22nd');
      expect(make('2026-06-23T00:00:00Z')).toBe('23rd');
    });

    it('isSameOrAfter / isSameOrBefore', () => {
      const base = new DateTick('en', 'UTC', '2020-06-15T00:00:00Z');
      expect(base.isSameOrAfter('2020-06-15T00:00:00Z')).toBe(true);
      expect(base.isSameOrAfter('2020-06-14T00:00:00Z')).toBe(true);
      expect(base.isSameOrAfter('2020-06-16T00:00:00Z')).toBe(false);
      expect(base.isSameOrBefore('2020-06-15T00:00:00Z')).toBe(true);
      expect(base.isSameOrBefore('2020-06-16T00:00:00Z')).toBe(true);
      expect(base.isSameOrBefore('2020-06-14T00:00:00Z')).toBe(false);
      expect(base.isSameOrAfter('2020-06-30T23:59:59Z', 'month')).toBe(true);
    });
  });

  describe('advanced format tokens', () => {
    const d = new DateTick('en', 'UTC', '2026-06-25T19:23:45.678Z'); // a Thursday, Q2

    it('Do / Q / k / kk / X / x', () => {
      expect(d.formatPattern('Do')).toBe('25th');
      expect(d.formatPattern('Q')).toBe('2');
      expect(d.formatPattern('k:kk')).toBe('19:19');
      expect(new DateTick('en', 'UTC', '2026-06-25T00:30:00Z').formatPattern('k kk')).toBe('24 24'); // midnight -> 24
      expect(d.formatPattern('X')).toBe(String(Math.floor(d.valueOf() / 1000)));
      expect(d.formatPattern('x')).toBe(String(d.valueOf()));
    });

    it('w / ww / W / WW', () => {
      expect(d.formatPattern('ww')).toMatch(/^\d{2}$/);
      expect(Number(d.formatPattern('w'))).toBeGreaterThan(0);
      expect(Number(d.formatPattern('W'))).toBe(d.isoWeek());
    });

    it('wo / Wo (ordinal week of year)', () => {
      const ordinal = (n: number): string => {
        if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
        return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
      };
      expect(d.formatPattern('wo')).toBe(ordinal(d.week()));
      expect(d.formatPattern('Wo')).toBe(ordinal(d.isoWeek()));
      // ww/WW continue to work unaffected by the new wo/Wo tokens
      expect(d.formatPattern('ww')).toMatch(/^\d{2}$/);
      expect(d.formatPattern('WW')).toMatch(/^\d{2}$/);
    });

    it('wo/Wo are consumed but ignored when parsing (derived values)', () => {
      expect(DateTick.parse('2026 23rd week', 'YYYY wo [week]', 'en', 'UTC').year()).toBe(2026);
      expect(DateTick.parse('2026 / 5th', 'YYYY / Wo', 'en', 'UTC').year()).toBe(2026);
    });
  });

  describe('localized format tokens', () => {
    const d = new DateTick('en', 'UTC', '2026-06-25T19:23:00Z'); // Thursday

    it('expands the L-family to English patterns', () => {
      expect(d.formatPattern('L')).toBe('06/25/2026');
      expect(d.formatPattern('LL')).toBe('June 25, 2026');
      expect(d.formatPattern('LLL')).toBe('June 25, 2026 7:23 PM');
      expect(d.formatPattern('LLLL')).toBe('Thursday, June 25, 2026 7:23 PM');
      expect(d.formatPattern('l')).toBe('6/25/2026');
      expect(d.formatPattern('ll')).toBe('Jun 25, 2026');
      expect(d.formatPattern('LT')).toBe('7:23 PM');
      expect(d.formatPattern('LTS')).toBe('7:23:00 PM');
    });

    it('honours locale for names inside localized tokens', () => {
      expect(new DateTick('fr', 'UTC', '2026-06-25T19:23:00Z').formatPattern('LL')).toMatch(/juin/i);
    });

    it('exposes locale metadata via localeData()', () => {
      const ld = new DateTick('fr', 'UTC', '2026-06-25T19:23:00Z').withWeekStart(1).localeData();
      expect(ld.months()[0]).toBe('janvier');
      expect(ld.monthsShort()).toHaveLength(12);
      expect(ld.weekdays()[0]).toMatch(/dimanche/i); // Sunday-based, index 0 = Sunday
      expect(ld.weekdaysShort()).toHaveLength(7);
      expect(ld.weekdaysMin()).toHaveLength(7);
      expect(ld.firstDayOfWeek()).toBe(1);
      expect(ld.ordinal(1)).toBe('1st');

      const en = new DateTick('en', 'UTC').localeData();
      expect(en.months()[0]).toBe('January');
      expect(en.meridiems()).toEqual({ am: 'AM', pm: 'PM' });
      expect(en.meridiem(15)).toBe('PM');
      expect(en.meridiem(9, true)).toBe('am');
    });

    it('follows each locale field order and separators (not a hardcoded US layout)', () => {
      const iso = '2026-06-25T19:23:00Z';
      // Numeric date order differs per locale: US month-first, GB/FR day-first, DE dot-separated, JA year-first.
      expect(new DateTick('en', 'UTC', iso).formatPattern('L')).toBe('06/25/2026');
      expect(new DateTick('en-GB', 'UTC', iso).formatPattern('L')).toBe('25/06/2026');
      expect(new DateTick('fr', 'UTC', iso).formatPattern('L')).toBe('25/06/2026');
      expect(new DateTick('de', 'UTC', iso).formatPattern('L')).toBe('25.06.2026');
      expect(new DateTick('ja', 'UTC', iso).formatPattern('L')).toBe('2026/06/25');

      // Long date puts the day before the month in fr/de, after in en.
      expect(new DateTick('fr', 'UTC', iso).formatPattern('LL')).toBe('25 juin 2026');
      expect(new DateTick('de', 'UTC', iso).formatPattern('LL')).toBe('25. Juni 2026');

      // 24-hour locales render LT without a meridiem.
      expect(new DateTick('en', 'UTC', iso).formatPattern('LT')).toBe('7:23 PM');
      expect(new DateTick('de', 'UTC', iso).formatPattern('LT')).toBe('19:23');
    });

    it('round-trips a locale-ordered L pattern back through parse', () => {
      // fr `L` is DD/MM/YYYY, so the day-first string must parse to the right instant.
      const parsed = DateTick.parse('25/06/2026', 'L', 'fr', 'UTC');
      expect(parsed.formatPattern('YYYY-MM-DD')).toBe('2026-06-25');
    });

    it('renders the meridiem (A/a) in the configured locale', () => {
      const iso = '2026-06-25T19:23:00Z'; // 19:23 -> PM
      expect(new DateTick('en', 'UTC', iso).formatPattern('A')).toBe('PM');
      expect(new DateTick('en', 'UTC', iso).formatPattern('a')).toBe('pm');
      // Chinese uses ideographic day-period markers rather than AM/PM.
      expect(new DateTick('zh', 'UTC', iso).formatPattern('A')).toBe('下午');
      expect(new DateTick('el', 'UTC', iso).formatPattern('A')).toBe('μ.μ.');
    });

    it('parses a locale meridiem back to the correct instant', () => {
      const zh = DateTick.parse('2026-06-25 下午 07:23', 'YYYY-MM-DD A hh:mm', 'zh', 'UTC');
      expect(zh.toISOString()).toBe('2026-06-25T19:23:00.000Z');
    });

    it('applies a factory ordinal override to ordinal()/Do/wo and localeData()', () => {
      const fr = datetick.withDefaults({ locale: 'fr', timezone: 'UTC', ordinal: (n) => (n === 1 ? '1er' : `${n}e`) });
      expect(fr('2026-06-01').ordinal()).toBe('1er');
      expect(fr('2026-06-02').formatPattern('Do')).toBe('2e');
      expect(fr('2026-06-02').localeData().ordinal(1)).toBe('1er');
      // Default (no override) stays English, and the override survives with*() rebuilds.
      expect(datetick('2026-06-02', { timezone: 'UTC' }).ordinal()).toBe('2nd');
      expect(fr('2026-06-01').withTimezone('Asia/Tokyo').ordinal()).toBe('1er');
    });
  });

  describe('configurable first-day-of-week', () => {
    // 2026-06-25 is a Thursday
    const d = new DateTick('en', 'UTC', '2026-06-25T12:00:00Z');

    it('defaults to Sunday', () => {
      expect(d.weekStart()).toBe(0);
      expect(d.startOf('week').formatPattern('ddd YYYY-MM-DD')).toBe('Sun 2026-06-21');
      expect(d.endOf('week').formatPattern('ddd YYYY-MM-DD')).toBe('Sat 2026-06-27');
    });

    it('respects a Monday week start', () => {
      const mon = d.withWeekStart(1);
      expect(mon.weekStart()).toBe(1);
      expect(mon.startOf('week').formatPattern('ddd YYYY-MM-DD')).toBe('Mon 2026-06-22');
      expect(mon.endOf('week').formatPattern('ddd YYYY-MM-DD')).toBe('Sun 2026-06-28');
    });

    it('week() numbering shifts with the week start', () => {
      // 2026-01-04 is a Sunday
      const sundayStart = new DateTick('en', 'UTC', '2026-01-04T00:00:00Z', 0);
      const mondayStart = sundayStart.withWeekStart(1);
      expect(sundayStart.week()).not.toBe(mondayStart.week());
    });

    it('is preserved across with* derivations', () => {
      expect(d.withWeekStart(1).withTimezone('Asia/Tokyo').weekStart()).toBe(1);
      expect(d.withWeekStart(6).add(1, 'day').weekStart()).toBe(6);
    });

    it('builds a padded calendar month using the configured week start', () => {
      const cal = d.withWeekStart(6).calendarMonth();
      expect(cal.label).toBe('June 2026');
      expect(cal.year).toBe(2026);
      expect(cal.month).toBe(5);
      expect(cal.weekdays.map((day) => day.short)).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      expect(cal.weeks).toHaveLength(5);
      expect(cal.days).toHaveLength(35);
      expect(cal.days[0]).toMatchObject({ year: 2026, month: 4, date: 30, day: 6, isCurrentMonth: false });
      expect(cal.days[2]).toMatchObject({ year: 2026, month: 5, date: 1, day: 1, isCurrentMonth: true });
      expect(cal.days.find((day) => day.isSelected)).toMatchObject({ isoDate: '2026-06-25' });
    });

    it('localizes calendar month labels and weekday labels', () => {
      const cal = new DateTick('fr', 'UTC', '2026-06-25T12:00:00Z', 1).calendarMonth();
      expect(cal.label).toMatch(/juin 2026/i);
      expect(cal.weekdays.map((day) => day.short)[0]).toMatch(/lun/i);
      expect(cal.days.find((day) => day.isoDate === '2026-06-25')).toMatchObject({ formatted: '25/06/2026' });
    });

    it('can render a viewed month with a separate selected date', () => {
      const cal = new DateTick('en', 'UTC', '2026-07-01T12:00:00Z', 0).calendarMonth({
        selected: '2026-06-25T12:00:00Z',
      });
      expect(cal.label).toBe('July 2026');
      expect(cal.days.some((day) => day.isSelected)).toBe(false);
    });

    it('formats calendar date cells with token, Intl and callback options', () => {
      const base = new DateTick('en', 'UTC', '2026-06-25T12:00:00Z', 0);
      expect(
        base.calendarMonth({ dateFormat: 'D MMM' }).days.find((day) => day.isoDate === '2026-06-25')
      ).toMatchObject({ formatted: '25 Jun' });
      expect(
        base
          .calendarMonth({ dateFormat: { month: 'short', day: 'numeric' } })
          .days.find((day) => day.isoDate === '2026-06-25')
      ).toMatchObject({ formatted: 'Jun 25' });
      expect(
        base
          .calendarMonth({ dateFormat: (date) => date.formatPattern('YYYY/MM/DD') })
          .days.find((day) => day.isoDate === '2026-06-25')
      ).toMatchObject({ formatted: '2026/06/25' });
    });
  });

  describe('compatibility helpers', () => {
    it('formats calendar-style relative labels', () => {
      const reference = new DateTick('en', 'UTC', '2026-06-25T12:00:00Z');
      expect(reference.calendar('2026-06-25T00:00:00Z')).toBe('Today at 12:00 PM');
      expect(reference.add(1, 'day').calendar(reference)).toBe('Tomorrow at 12:00 PM');
      expect(reference.subtract(1, 'day').calendar(reference)).toBe('Yesterday at 12:00 PM');
      expect(reference.add(3, 'day').calendar(reference)).toBe('Sunday at 12:00 PM');
      expect(reference.subtract(3, 'day').calendar(reference)).toBe('Last Monday at 12:00 PM');
      expect(reference.add(8, 'day').calendar(reference)).toBe('07/03/2026');
      expect(reference.calendar(reference, { sameDay: '[same-day] YYYY-MM-DD' })).toBe('same-day 2026-06-25');
      expect(reference.calendar(reference, { sameDay: (date) => date.formatPattern('YYYY/MM/DD') })).toBe('2026/06/25');
    });

    it('formats relative time with from/fromNow/to/toNow aliases', () => {
      const base = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');
      const future = base.add(2, 'hour');
      expect(future.from(base)).toBe('in 2 hours');
      expect(future.from(base, true)).toBe('2 hours');
      expect(base.to(future)).toBe('in 2 hours');
      expect(base.to(future, true)).toBe('2 hours');

      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
        expect(future.fromNow()).toBe('in 2 hours');
        expect(future.toNow()).toBe('2 hours ago');
      } finally {
        jest.useRealTimers();
      }
    });

    it('exposes utc/local timezone helpers and utcOffset', () => {
      const zoned = new DateTick('en', 'Asia/Nicosia', '2026-06-25T19:23:00Z');
      expect(zoned.utcOffset()).toBe(180);
      expect(zoned.utc().timezone()).toBe('UTC');
      expect(zoned.utc().hour()).toBe(19);
      expect(zoned.local().timezone()).toBe(DateTick.guessTimezone());
      expect(zoned.local().valueOf()).toBe(zoned.valueOf());
    });
  });

  describe('Duration', () => {
    it('creates from amount + unit and converts (as*)', () => {
      expect(DateTick.duration(90, 'minute').asHours()).toBe(1.5);
      expect(DateTick.duration(2, 'day').asHours()).toBe(48);
      expect(DateTick.duration(1000).asSeconds()).toBe(1);
    });

    it('creates from a components object', () => {
      const dur = new Duration({ days: 1, hours: 2, minutes: 30 });
      expect(dur.asMinutes()).toBe(24 * 60 + 2 * 60 + 30);
    });

    it('parses ISO 8601 duration strings (and round-trips toISOString)', () => {
      expect(DateTick.duration('PT1H30M').asMinutes()).toBe(90);
      expect(DateTick.duration('P1Y2M3DT4H5M6S').toISOString()).toBe('P1Y2M3DT4H5M6S');
      expect(DateTick.duration('P1W').asDays()).toBe(7);
      expect(new Duration('PT0.5S').asMilliseconds()).toBe(500);
      expect(new Duration('PT1,5H').asMinutes()).toBe(90); // comma decimal
      expect(new Duration('-PT1H30M').asMinutes()).toBe(-90);
    });

    it('throws on an invalid ISO 8601 duration string', () => {
      expect(() => new Duration('P')).toThrow(/Invalid ISO 8601 duration/);
      expect(() => new Duration('banana')).toThrow(/Invalid ISO 8601 duration/);
    });

    it('identifies Duration instances', () => {
      expect(Duration.isDuration(DateTick.duration(1, 'day'))).toBe(true);
      expect(Duration.isDuration(new DateTick('en', 'UTC'))).toBe(false);
    });

    it('decomposes into signed components', () => {
      const dur = DateTick.duration(400, 'day');
      expect(dur.years()).toBe(1);
      expect(dur.months()).toBe(1);
      expect(dur.days()).toBe(5);
      const neg = DateTick.duration(-90, 'minute');
      expect(neg.hours()).toBe(-1);
      expect(neg.minutes()).toBe(-30);
    });

    it('humanizes (locale-aware, optional suffix)', () => {
      expect(DateTick.duration(2, 'hour').humanize()).toBe('2 hours');
      expect(DateTick.duration(2, 'hour').humanize(true)).toBe('in 2 hours');
      expect(DateTick.duration(-3, 'day').humanize(true)).toBe('3 days ago');
      expect(DateTick.duration(30, 'second').humanize()).toMatch(/second/);
      expect(DateTick.duration(2, 'day', 'fr').humanize()).toMatch(/jours/);
    });

    it('add / subtract', () => {
      expect(DateTick.duration(1, 'hour').add(30, 'minute').asMinutes()).toBe(90);
      expect(DateTick.duration(2, 'hour').subtract(1, 'hour').asHours()).toBe(1);
    });

    it('defaults duration add/subtract units to milliseconds', () => {
      expect(DateTick.duration(1000).add(500).asMilliseconds()).toBe(1500);
      expect(DateTick.duration(1000).subtract(500).asMilliseconds()).toBe(500);
    });

    it('throws on invalid units from untyped callers', () => {
      expect(() => DateTick.duration(1, 'fortnight' as any)).toThrow(/Invalid duration unit/);
      expect(() => DateTick.duration(1, 'day').add(1, 'fortnight' as any)).toThrow(/Invalid duration unit/);
    });

    it('toISOString / toJSON / valueOf', () => {
      expect(new Duration({ years: 1, months: 2, days: 3, hours: 4, minutes: 5, seconds: 6 }).toISOString()).toBe(
        'P1Y2M3DT4H5M6S'
      );
      expect(DateTick.duration(90, 'minute').toISOString()).toBe('PT1H30M');
      expect(DateTick.duration(-90, 'minute').toISOString()).toBe('-PT1H30M');
      expect(DateTick.duration(0).toISOString()).toBe('P0D');
      expect(+DateTick.duration(5, 'second')).toBe(5000);
      expect(JSON.stringify({ d: new Duration({ hours: 5 }) })).toBe('{"d":"PT5H"}');
    });

    it('omits the T-separator entirely for a date-only duration', () => {
      expect(new Duration({ years: 1, months: 2, days: 3 }).toISOString()).toBe('P1Y2M3D');
      expect(new Duration({ days: 5 }).toISOString()).toBe('P5D');
    });

    it('pairs naturally with diff', () => {
      const span = new DateTick('en', 'UTC', '2020-03-01').diff('2020-01-01');
      expect(DateTick.duration(span).humanize()).toBe('2 months');
    });

    it('exposes the full as*/component accessor surface', () => {
      const dur = DateTick.duration(1, 'week');
      expect(dur.as('week')).toBe(1);
      expect(dur.asMilliseconds()).toBe(604_800_000);
      expect(dur.asSeconds()).toBe(604_800);
      expect(dur.asMinutes()).toBe(10_080);
      expect(dur.asHours()).toBe(168);
      expect(dur.asDays()).toBe(7);
      expect(dur.asWeeks()).toBe(1);
      expect(dur.asMonths()).toBeCloseTo(7 / 30, 5);
      expect(dur.asYears()).toBeCloseTo(7 / 365, 5);

      const c = new Duration({ hours: 1, minutes: 2, seconds: 3, milliseconds: 4 });
      expect(c.hours()).toBe(1);
      expect(c.minutes()).toBe(2);
      expect(c.seconds()).toBe(3);
      expect(c.milliseconds()).toBe(4);
      expect(c.years()).toBe(0);
    });

    it('supports duration get() and format()', () => {
      const dur = new Duration({ years: 1, months: 5, days: 8, hours: 4, minutes: 5, seconds: 6, milliseconds: 7 });
      expect(dur.get('year')).toBe(1);
      expect(dur.get('quarter')).toBe(1);
      expect(dur.get('month')).toBe(5);
      expect(dur.get('week')).toBe(1);
      expect(dur.get('day')).toBe(8);
      expect(dur.get('hour')).toBe(4);
      expect(dur.get('minute')).toBe(5);
      expect(dur.get('second')).toBe(6);
      expect(dur.get('millisecond')).toBe(7);
      expect(dur.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('0001-05-08 04:05:06.007');
      expect(dur.format('[duration] H:m:s')).toBe('duration 4:5:6');
      expect(new Duration(-90, 'minute').format('HH:mm:ss')).toBe('-01:30:00');
      expect(() => dur.get('fortnight' as any)).toThrow(/Invalid duration unit/);
    });

    it('humanizes larger spans (minutes/days/years thresholds)', () => {
      expect(DateTick.duration(5, 'minute').humanize()).toMatch(/minute/);
      expect(DateTick.duration(5, 'day').humanize()).toMatch(/day/);
      expect(DateTick.duration(2, 'year').humanize()).toMatch(/year/);
    });
  });

  describe('parsing advanced tokens', () => {
    it('parses Do, kk and consumes Q/w', () => {
      expect(DateTick.parse('June 25th, 2026', 'MMMM Do, YYYY', 'en', 'UTC').toISOString()).toBe(
        '2026-06-25T00:00:00.000Z'
      );
      expect(DateTick.parse('2026-06-25 24:00', 'YYYY-MM-DD kk:mm', 'en', 'UTC').toISOString()).toBe(
        '2026-06-25T00:00:00.000Z' // 24 -> 0
      );
      expect(DateTick.parse('2026 Q2', 'YYYY [Q]Q', 'en', 'UTC').year()).toBe(2026);
    });

    it('parses unix tokens X (seconds) and x (milliseconds)', () => {
      expect(DateTick.parse('1782760980', 'X', 'en', 'UTC').valueOf()).toBe(1782760980 * 1000);
      expect(DateTick.parse('1782760980123', 'x', 'en', 'UTC').valueOf()).toBe(1782760980123);
      expect(DateTick.parse('-315619200', 'X', 'en', 'UTC').toISOString()).toBe('1960-01-01T00:00:00.000Z');
      expect(DateTick.parse('-315619200000', 'x', 'en', 'UTC').toISOString()).toBe('1960-01-01T00:00:00.000Z');
    });
  });

  describe('conversion', () => {
    const dt = new DateTick('en', 'UTC', '2020-01-02T03:04:05.006Z');

    it('toDate returns a fresh Date', () => {
      const d = dt.toDate();
      expect(d).toBeInstanceOf(Date);
      d.setFullYear(1999);
      expect(dt.year()).toBe(2020); // not affected
    });

    it('toISOString / toJSON', () => {
      expect(dt.toISOString()).toBe('2020-01-02T03:04:05.006Z');
      expect(JSON.stringify({ d: dt })).toBe('{"d":"2020-01-02T03:04:05.006Z"}');
    });

    it('toArray / toObject return zoned calendar parts', () => {
      expect(dt.toArray()).toEqual([2020, 0, 2, 3, 4, 5, 6]);
      expect(dt.toObject()).toEqual({
        year: 2020,
        month: 0,
        date: 2,
        hour: 3,
        minute: 4,
        second: 5,
        millisecond: 6,
        day: 4,
      });
    });

    it('toString', () => {
      expect(typeof dt.toString()).toBe('string');
    });

    it('unix / valueOf', () => {
      expect(dt.valueOf()).toBe(Date.parse('2020-01-02T03:04:05.006Z'));
      expect(dt.unix()).toBe(Math.floor(Date.parse('2020-01-02T03:04:05.006Z') / 1000));
    });

    it('valueOf enables numeric coercion', () => {
      const earlier = new DateTick('en', 'UTC', '2019-01-01T00:00:00Z');
      expect(+dt > +earlier).toBe(true);
    });
  });

  describe('with* derivations', () => {
    const dt = new DateTick('en', 'UTC', '2020-01-01T00:00:00Z');

    it('withDate keeps locale & timezone', () => {
      const next = dt.withDate('2021-06-01T00:00:00Z');
      expect(next.locale()).toBe('en');
      expect(next.timezone()).toBe('UTC');
      expect(next.year()).toBe(2021);
    });

    it('withLocale / withTimezone keep the date', () => {
      expect(dt.withLocale('de').locale()).toBe('de');
      expect(dt.withLocale('de').valueOf()).toBe(dt.valueOf());
      expect(dt.withTimezone('Asia/Tokyo').timezone()).toBe('Asia/Tokyo');
      expect(dt.withTimezone('Asia/Tokyo').valueOf()).toBe(dt.valueOf());
    });
  });

  describe('timezone awareness', () => {
    it('reads components in the configured timezone, not the host', () => {
      // 2026-06-25T19:23:00Z is 22:23 in Cyprus (UTC+3 summer) and 15:23 in New York (UTC-4 summer)
      const instant = '2026-06-25T19:23:00Z';
      expect(new DateTick('en', 'UTC', instant).hour()).toBe(19);
      expect(new DateTick('en', 'Asia/Nicosia', instant).hour()).toBe(22);
      expect(new DateTick('en', 'America/New_York', instant).hour()).toBe(15);
    });

    it('builds the right instant when setting wall-clock components in a zone', () => {
      // Typing 22:23 with timezone UTC should mean 22:23 UTC, regardless of host timezone
      const dt = new DateTick('en', 'UTC').year(2026).month(5).date(25).hour(22).minute(23).second(0).millisecond(0);
      expect(dt.toISOString()).toBe('2026-06-25T22:23:00.000Z');
      expect(dt.format('isoStyle24h')).toContain('22:23:00');
    });

    it('the same wall clock in different zones maps to different instants', () => {
      const make = (tz: string): DateTick =>
        new DateTick('en', tz).year(2026).month(0).date(15).hour(12).minute(0).second(0).millisecond(0);
      expect(make('UTC').toISOString()).toBe('2026-01-15T12:00:00.000Z');
      expect(make('Asia/Tokyo').toISOString()).toBe('2026-01-15T03:00:00.000Z'); // JST = UTC+9
      expect(make('America/New_York').toISOString()).toBe('2026-01-15T17:00:00.000Z'); // EST = UTC-5
    });

    it('day-of-week, quarter and week are computed in the configured zone', () => {
      // 2026-01-01T03:00:00Z is still Dec 31 2025 (a Wednesday) in New York
      const ny = new DateTick('en', 'America/New_York', '2026-01-01T03:00:00Z');
      expect(ny.year()).toBe(2025);
      expect(ny.month()).toBe(11);
      expect(ny.date()).toBe(31);
      expect(ny.day()).toBe(3); // Wednesday
      expect(ny.quarter()).toBe(4);
    });

    it('calendar add preserves wall-clock time across a DST spring-forward', () => {
      // US DST begins 2026-03-08 02:00 -> 03:00. Adding a day to Mar 7 09:00 should stay 09:00 local.
      const before = new DateTick('en', 'America/New_York')
        .year(2026)
        .month(2)
        .date(7)
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0);
      const after = before.add(1, 'day');
      expect(after.hour()).toBe(9);
      expect(after.date()).toBe(8);
      // ...but the absolute gap is only 23 hours because a clock-hour was skipped
      expect(after.diff(before, 'hour')).toBe(23);
    });

    it('resolves a wall-clock instant correctly even when constructed right at a DST boundary', () => {
      // 2026-03-08 02:00 -> 03:00 in America/New_York (the skipped hour starts at 07:00 UTC).
      // A naive single-pass conversion (treat the wall-clock numbers as UTC, then subtract the
      // offset measured at THAT instant) gets 03:00 local wrong by a full hour: it would compute
      // 2026-03-08T08:00:00Z, which is actually 04:00 EDT, not 03:00 EDT. The real answer is 07:00Z.
      const justAfterSpringForward = new DateTick('en', 'America/New_York')
        .year(2026)
        .month(2)
        .date(8)
        .hour(3)
        .minute(0)
        .second(0)
        .millisecond(0);
      expect(justAfterSpringForward.toISOString()).toBe('2026-03-08T07:00:00.000Z');
      expect(justAfterSpringForward.hour()).toBe(3); // round-trips back to the wall clock we asked for

      // And the symmetric case around the US fall-back (2026-11-01 02:00 -> 01:00, repeated hour).
      const justAfterFallBack = new DateTick('en', 'America/New_York')
        .year(2026)
        .month(10)
        .date(1)
        .hour(3)
        .minute(0)
        .second(0)
        .millisecond(0);
      expect(justAfterFallBack.toISOString()).toBe('2026-11-01T08:00:00.000Z');
      expect(justAfterFallBack.hour()).toBe(3);
    });

    it('rolls forward (not backward) when the requested wall-clock time is in a spring-forward gap', () => {
      // America/Sao_Paulo sprang forward at local midnight on 2018-11-04 (00:00 -> 01:00), so
      // 2018-11-04 00:00 never existed. startOf('day') must land on the first valid instant of that
      // day (01:00 -02:00 = 03:00Z), NOT roll backward onto 2018-11-03.
      const start = new DateTick('en', 'America/Sao_Paulo', '2018-11-04T15:00:00Z').startOf('day');
      expect(start.toISOString()).toBe('2018-11-04T03:00:00.000Z');
      expect(start.date()).toBe(4); // stays on the requested calendar day
      expect(start.hour()).toBe(1); // first wall-clock hour that actually exists
    });

    it('rolls a day-add forward through a spring-forward gap (Southern hemisphere)', () => {
      // Australia/Sydney sprang forward 2021-10-03 (02:00 -> 03:00), so 02:30 never existed that day.
      const jumped = new DateTick('en', 'Australia/Sydney', '2021-10-02T02:30:00+10:00').add(1, 'day');
      expect(jumped.formatPattern('YYYY-MM-DD HH:mm Z')).toBe('2021-10-03 03:30 +11:00');
    });

    it('calendar add across DST preserves wall clock while diff/diffCalendar split elapsed vs calendar', () => {
      // NY 2021 spring-forward day (2021-03-14) is only 23 hours long.
      const before = new DateTick('en', 'America/New_York', '2021-03-13T12:00:00-05:00');
      const after = before.add(1, 'day');
      expect(after.formatPattern('YYYY-MM-DD HH:mm')).toBe('2021-03-14 12:00'); // wall clock kept
      expect(after.diff(before, 'hour')).toBe(23); // but only 23 hours elapsed

      // Spanning the transition: 47 hours elapsed => 1 whole elapsed day, yet 2 calendar days apart.
      const d13 = new DateTick('en', 'America/New_York', '2021-03-13T00:00:00-05:00');
      const d15 = new DateTick('en', 'America/New_York', '2021-03-15T00:00:00-04:00');
      expect(d15.diff(d13, 'day')).toBe(1);
      expect(d15.diffCalendar(d13, 'day')).toBe(2);
    });

    it('startOf("day") snaps to local midnight in the zone', () => {
      const tokyo = new DateTick('en', 'Asia/Tokyo', '2026-06-25T19:23:00Z'); // 2026-06-26 04:23 JST
      const start = tokyo.startOf('day');
      expect(start.hour()).toBe(0);
      expect(start.date()).toBe(26);
      expect(start.toISOString()).toBe('2026-06-25T15:00:00.000Z'); // 2026-06-26 00:00 JST
    });

    it('withTimezone keeps the instant but re-interprets the wall clock', () => {
      const utc = new DateTick('en', 'UTC', '2026-06-25T19:23:00Z');
      const nicosia = utc.withTimezone('Asia/Nicosia');
      expect(nicosia.valueOf()).toBe(utc.valueOf()); // same instant
      expect(nicosia.hour()).toBe(22); // different wall clock
    });
  });

  describe('validation', () => {
    it('throws when setting on an invalid date', () => {
      const bad = new DateTick('en', 'UTC', 'not-a-date');
      expect(() => bad.year(2020)).toThrow(/Invalid date/);
    });

    it('throws in diff against an invalid input', () => {
      const dt = new DateTick('en', 'UTC', '2020-01-01');
      expect(() => dt.diff('not-a-date', 'day')).toThrow(/Invalid date/);
    });
  });

  describe('timeAgo', () => {
    const dt = new DateTick('en', 'UTC');

    it('returns a string for a past date', () => {
      const result = dt.withDate(new Date(Date.now() - 60_000)).timeAgo();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/minute/);
    });

    it('returns a string for a future date', () => {
      const result = dt.withDate(new Date(Date.now() + 60_000)).timeAgo();
      expect(typeof result).toBe('string');
    });

    it('handles seconds, hours, days, months, years ranges', () => {
      expect(dt.withDate(new Date(Date.now() - 5_000)).timeAgo()).toMatch(/second/);
      expect(dt.withDate(new Date(Date.now() - 2 * 3_600_000)).timeAgo()).toMatch(/hour/);
      expect(dt.withDate(new Date(Date.now() - 3 * 86_400_000)).timeAgo()).toMatch(/day/);
      expect(dt.withDate(new Date(Date.now() - 40 * 86_400_000)).timeAgo()).toMatch(/month/);
      expect(dt.withDate(new Date(Date.now() - 400 * 86_400_000)).timeAgo()).toMatch(/year/);
    });

    it('honours custom step-up thresholds', () => {
      const ninetySecAgo = dt.withDate(new Date(Date.now() - 90_000));
      // Default: 90s -> minutes. Raising the second cutoff keeps it in seconds.
      expect(ninetySecAgo.timeAgo()).toMatch(/minute/);
      expect(ninetySecAgo.timeAgo(undefined, { second: 120 })).toMatch(/second/);
      // Lowering the hour cutoff pushes ~90 minutes up into hours.
      const ninetyMinAgo = dt.withDate(new Date(Date.now() - 90 * 60_000));
      expect(ninetyMinAgo.timeAgo(undefined, { minute: 1 })).toMatch(/hour/);
    });
  });

  describe('timeAgoLive', () => {
    it('emits a timeAgo string immediately', () => {
      const dt = new DateTick('en', 'UTC', new Date(Date.now() - 5000));
      const values: string[] = [];
      const live = dt.timeAgoLive();
      live.subscribe((value) => values.push(value));
      live.unsubscribe();
      expect(values).toHaveLength(1);
      expect(values[0]).toMatch(/second/);
    });

    it('refreshes on a timer (fake timers)', () => {
      jest.useFakeTimers();
      try {
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 5000));
        const emissions: string[] = [];
        const live = dt.timeAgoLive();
        const unsubscribe = live.subscribe((v) => emissions.push(v));
        expect(emissions.length).toBe(1); // immediate
        jest.advanceTimersByTime(1000);
        expect(emissions.length).toBe(2); // after first 1s tick
        jest.advanceTimersByTime(1000);
        expect(emissions.length).toBe(3);
        unsubscribe();
        jest.advanceTimersByTime(5000);
        expect(emissions.length).toBe(3); // no emissions after unsubscribe
      } finally {
        jest.useRealTimers();
      }
    });

    it('supports the timeAgoSubscribe convenience helper', () => {
      jest.useFakeTimers();
      try {
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 5000));
        const emissions: string[] = [];
        const unsubscribe = dt.timeAgoSubscribe((value) => emissions.push(value));
        expect(emissions).toHaveLength(1);
        unsubscribe();
        jest.advanceTimersByTime(5000);
        expect(emissions).toHaveLength(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('gives a late subscriber an immediate value without restarting the shared timer', () => {
      jest.useFakeTimers();
      try {
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 5000));
        const live = dt.timeAgoLive();
        const first: string[] = [];
        const second: string[] = [];
        const unsubFirst = live.subscribe((v) => first.push(v));
        expect(first).toHaveLength(1);

        // Second subscriber joins an already-running stream: gets one immediate value
        // (the `else` branch), without a second timer being started.
        const unsubSecond = live.subscribe((v) => second.push(v));
        expect(second).toHaveLength(1);

        jest.advanceTimersByTime(1000);
        expect(first.length).toBeGreaterThan(1);
        expect(second.length).toBeGreaterThan(1);
        expect(first.length).toBe(second.length); // both driven by the same shared timer

        unsubFirst();
        unsubSecond();
      } finally {
        jest.useRealTimers();
      }
    });

    it('adapts its refresh interval as the target moves further away (minute/hour/day tiers)', () => {
      jest.useFakeTimers();
      try {
        // Starts ~2 minutes away: should use the 30s tier, not the 1s tier.
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 120_000));
        const emissions: string[] = [];
        const live = dt.timeAgoLive();
        live.subscribe((v) => emissions.push(v));
        expect(emissions).toHaveLength(1);

        jest.advanceTimersByTime(1000);
        expect(emissions).toHaveLength(1); // the 1s tier would have fired by now; the 30s tier hasn't

        jest.advanceTimersByTime(29_000);
        expect(emissions).toHaveLength(2);

        live.unsubscribe();
      } finally {
        jest.useRealTimers();
      }
    });

    it('uses the 30-minute tier once the target is more than an hour away (but under a day)', () => {
      jest.useFakeTimers();
      try {
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 5 * 3_600_000)); // 5 hours away
        const emissions: string[] = [];
        const live = dt.timeAgoLive();
        live.subscribe((v) => emissions.push(v));
        expect(emissions).toHaveLength(1);

        jest.advanceTimersByTime(1_799_000); // just under 30 minutes: no tick yet
        expect(emissions).toHaveLength(1);

        jest.advanceTimersByTime(1_000); // total 30 minutes: tick fires
        expect(emissions).toHaveLength(2);

        live.unsubscribe();
      } finally {
        jest.useRealTimers();
      }
    });

    it('uses the hour tier once the target is more than a day away', () => {
      jest.useFakeTimers();
      try {
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 2 * 86_400_000)); // 2 days away
        const emissions: string[] = [];
        const live = dt.timeAgoLive();
        live.subscribe((v) => emissions.push(v));
        expect(emissions).toHaveLength(1);

        jest.advanceTimersByTime(3_599_000); // just under an hour: no tick yet
        expect(emissions).toHaveLength(1);

        jest.advanceTimersByTime(1_000); // total 1 hour: tick fires
        expect(emissions).toHaveLength(2);

        live.unsubscribe();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('datetick() factory', () => {
    it('creates a DateTick from a string/Date/DateTick', () => {
      expect(datetick('2026-06-25T19:23:00Z', { timezone: 'UTC' })).toBeInstanceOf(DateTick);
      expect(datetick('2026-06-25T19:23:00Z', { timezone: 'UTC' }).toISOString()).toBe('2026-06-25T19:23:00.000Z');
      const t = datetick('2026-06-25T19:23:00Z');
      expect(datetick(t, { timezone: 'UTC' }).valueOf()).toBe(t.valueOf());
    });

    it('defaults to now with no argument', () => {
      const before = Date.now();
      const v = datetick().valueOf();
      expect(v).toBeGreaterThanOrEqual(before);
      expect(v).toBeLessThanOrEqual(Date.now());
    });

    it('passes through locale, timezone and weekStartsOn options', () => {
      const t = datetick('2026-06-25T19:23:00Z', { locale: 'fr', timezone: 'Asia/Nicosia', weekStartsOn: 1 });
      expect(t.locale()).toBe('fr');
      expect(t.timezone()).toBe('Asia/Nicosia');
      expect(t.weekStart()).toBe(1);
      expect(t.hour()).toBe(22); // UTC+3
    });

    it('datetick.utc shorthand fixes the timezone to UTC', () => {
      expect(datetick.utc('2026-06-25T19:23:00Z').timezone()).toBe('UTC');
      expect(datetick.utc('2026-06-25T19:23:00Z').hour()).toBe(19);
    });

    it('datetick.unix builds from seconds', () => {
      expect(datetick.unix(1782760980, { timezone: 'UTC' }).toISOString()).toBe('2026-06-29T19:23:00.000Z');
    });

    it('datetick.unix works with no options argument', () => {
      expect(datetick.unix(1782760980).toISOString()).toBe('2026-06-29T19:23:00.000Z');
    });

    it('exposes static helpers (duration / parse / min / max / isValid / guessTimezone)', () => {
      expect(datetick.duration(2, 'hour').humanize()).toBe('2 hours');
      expect(datetick.parse('25/06/2026', 'DD/MM/YYYY', 'en', 'UTC').toISOString()).toBe('2026-06-25T00:00:00.000Z');
      expect(datetick.parse('2026-06-25', 'YYYY-MM-DD').toISOString()).toBe('2026-06-25T00:00:00.000Z');
      expect(typeof datetick.guessTimezone()).toBe('string');
      expect(datetick.isValid('2026-06-25')).toBe(true);
      expect(datetick.isValid('nope')).toBe(false);
      expect(datetick.max('2020-01-01', '2021-01-01').getUTCFullYear()).toBe(2021);
      expect(datetick.min('2020-01-01', '2021-01-01').getUTCFullYear()).toBe(2020);
      expect(datetick.isDateTick(datetick())).toBe(true);
      expect(datetick.isDuration(datetick.duration(1, 'day'))).toBe(true);
    });

    describe('withDefaults', () => {
      it('returns an independent factory without mutating the original', () => {
        const frDateTick = datetick.withDefaults({ locale: 'fr', timezone: 'Europe/Paris' });
        expect(frDateTick('2026-06-25T19:23:00Z').locale()).toBe('fr');
        expect(frDateTick('2026-06-25T19:23:00Z').timezone()).toBe('Europe/Paris');
        // the base factory is untouched
        expect(datetick('2026-06-25T19:23:00Z').locale()).toBe('en');
      });

      it('flows defaults into duration() and parse() too', () => {
        const frDateTick = datetick.withDefaults({ locale: 'fr', timezone: 'Europe/Paris' });
        expect(frDateTick.duration(2, 'day').humanize()).toMatch(/jours/);
        const parsed = frDateTick.parse('25/06/2026', 'DD/MM/YYYY');
        expect(parsed.locale()).toBe('fr');
        expect(parsed.timezone()).toBe('Europe/Paris');
      });

      it('merges progressively when chained', () => {
        const refined = datetick.withDefaults({ locale: 'fr' }).withDefaults({ weekStartsOn: 1 });
        const t = refined('2026-06-25');
        expect(t.locale()).toBe('fr'); // preserved from the first withDefaults call
        expect(t.weekStart()).toBe(1);
      });

      it('per-call options still override the factory defaults', () => {
        const frDateTick = datetick.withDefaults({ locale: 'fr' });
        expect(frDateTick('2026-06-25', { locale: 'de' }).locale()).toBe('de');
      });
    });
  });

  describe('review hardening', () => {
    it('accepts a numeric Unix-millisecond input', () => {
      const ms = Date.UTC(2020, 0, 2, 3, 4, 5, 6);
      expect(new DateTick('en', 'UTC', ms).valueOf()).toBe(ms);
      expect(datetick(ms, { timezone: 'UTC' }).toISOString()).toBe('2020-01-02T03:04:05.006Z');
    });

    it('returns NaN from getters (instead of throwing) for an invalid date', () => {
      const invalid = new DateTick('en', 'UTC', 'not-a-date');
      expect(invalid.isValid()).toBe(false);
      expect(Number.isNaN(invalid.year())).toBe(true);
      expect(Number.isNaN(invalid.month())).toBe(true);
      expect(Number.isNaN(invalid.hour())).toBe(true);
    });

    it('year diff is 0 for dates under a year apart across a calendar boundary', () => {
      const a = new DateTick('en', 'UTC', '2026-01-15T00:00:00Z');
      expect(a.diff('2025-12-15T00:00:00Z', 'year')).toBe(0);
    });

    it('parses month names case-insensitively', () => {
      expect(DateTick.parse('JUNE 25, 2026', 'MMMM D, YYYY', 'en', 'UTC').toISOString()).toBe(
        DateTick.parse('June 25, 2026', 'MMMM D, YYYY', 'en', 'UTC').toISOString()
      );
      expect(DateTick.parse('june 25, 2026', 'MMMM D, YYYY', 'en', 'UTC').month()).toBe(5);
    });

    it('parses an adjacent month/day token with no separator', () => {
      expect(DateTick.parse('May25th', 'MMMMDo', 'en', 'UTC').month()).toBe(4);
      expect(DateTick.parse('May25th', 'MMMMDo', 'en', 'UTC').date()).toBe(25);
    });

    it('Duration tolerates null/undefined and unwraps a Duration instance', () => {
      expect(DateTick.duration(null as any).asMilliseconds()).toBe(0);
      expect(DateTick.duration(undefined as any).asMilliseconds()).toBe(0);
      const d = DateTick.duration(90, 'minute');
      expect(DateTick.duration(d as any).asMilliseconds()).toBe(d.asMilliseconds());
    });

    it('does not leak a timer when a listener unsubscribes during notification', () => {
      jest.useFakeTimers();
      try {
        const dt = new DateTick('en', 'UTC', new Date(Date.now() - 1000));
        const live = dt.timeAgoLive();
        let calls = 0;
        // The first notification fires synchronously inside subscribe(); unsubscribe on a later tick
        // (so `unsubscribe` is only referenced once it has been initialized).
        const unsubscribe = live.subscribe(() => {
          calls++;
          if (calls >= 2) unsubscribe();
        });
        expect(calls).toBe(1);
        expect(jest.getTimerCount()).toBe(1); // a follow-up tick is scheduled
        jest.advanceTimersByTime(1000); // fires the next tick; the listener unsubscribes during it
        expect(calls).toBe(2);
        // With the leak guard, draining the listener set stops the loop instead of rescheduling.
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
