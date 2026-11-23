export const DEFAULT_TZ = "America/Chicago";

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-12-05T10:30" (wall-clock time in `timeZone`) → UTC Date. DST-safe. */
export function zonedInputToUtc(value: string, timeZone = DEFAULT_TZ): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid date/time: ${value}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  const second = guess - tzOffsetMs(new Date(utc), timeZone);
  if (second !== utc) utc = second;
  return new Date(utc);
}

/** UTC Date → "YYYY-MM-DDTHH:mm" for a datetime-local input in `timeZone`. */
export function utcToZonedInput(date: Date, timeZone = DEFAULT_TZ): string {
  const local = new Date(date.getTime() + tzOffsetMs(date, timeZone));
  return local.toISOString().slice(0, 16);
}

export function formatDateTime(date: Date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatDate(date: Date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTimeRange(start: Date, end: Date, timeZone = DEFAULT_TZ) {
  const t = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d);
  return `${t(start)} – ${t(end)}`;
}
