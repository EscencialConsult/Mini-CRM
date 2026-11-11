/**
 * Text <-> value conversions of the date picker. Values are the strings the
 * date inputs store in the form: "YYYY-MM-DD", or "YYYY-MM-DDTHH:mm" with a
 * time. The text the user sees and types is "DD/MM/YYYY[ HH:mm]"; ISO text is
 * accepted too.
 */

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

const ISO_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?$/;
const LOCAL_PATTERN =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
}

const readParts = (text: string): DateParts | undefined => {
  const iso = ISO_PATTERN.exec(text);
  if (iso) {
    const [, year, month, day, hours = "0", minutes = "0"] = iso;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hours: Number(hours),
      minutes: Number(minutes),
    };
  }
  const local = LOCAL_PATTERN.exec(text);
  if (local) {
    const [, day, month, year, hours = "0", minutes = "0"] = local;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hours: Number(hours),
      minutes: Number(minutes),
    };
  }
  return undefined;
};

const isRealDate = ({ year, month, day, hours, minutes }: DateParts) => {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    hours < 24 &&
    minutes < 60
  );
};

export const toDateValue = (
  { year, month, day, hours, minutes }: DateParts,
  withTime: boolean,
): string => {
  const date = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return withTime ? `${date}T${pad(hours)}:${pad(minutes)}` : date;
};

/**
 * Normalizes what the user typed: the value to store, "" when cleared, or
 * undefined when the text is not a valid date.
 */
export const parseDateText = (
  text: string,
  withTime: boolean,
): string | undefined => {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const parts = readParts(trimmed);
  if (!parts || !isRealDate(parts)) return undefined;
  return toDateValue(parts, withTime);
};

/** The text shown for a stored value, "" for an empty or unreadable value. */
export const formatDateText = (
  value: string | null | undefined,
  withTime: boolean,
): string => {
  const parts = value ? readParts(value) : undefined;
  if (!parts) return "";
  const date = `${pad(parts.day)}/${pad(parts.month)}/${pad(parts.year, 4)}`;
  return withTime ? `${date} ${pad(parts.hours)}:${pad(parts.minutes)}` : date;
};

/** The calendar day of a stored value, if any. */
export const dateFromValue = (
  value: string | null | undefined,
): Date | undefined => {
  const parts = value ? readParts(value) : undefined;
  return parts && isRealDate(parts)
    ? new Date(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hours,
        parts.minutes,
      )
    : undefined;
};

/** The stored value of a picked day, keeping the time of `current` if any. */
export const valueFromDay = (
  day: Date,
  current: string | null | undefined,
  withTime: boolean,
): string => {
  const time = dateFromValue(current);
  return toDateValue(
    {
      year: day.getFullYear(),
      month: day.getMonth() + 1,
      day: day.getDate(),
      hours: time?.getHours() ?? 9,
      minutes: time?.getMinutes() ?? 0,
    },
    withTime,
  );
};
