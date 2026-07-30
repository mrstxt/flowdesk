const DEFAULT_TIME_ZONE = "Asia/Tashkent";

function getTimeZone(): string {
  const configured = process.env.APP_TIMEZONE || DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured }).format();
    return configured;
  } catch {
    console.warn(
      `APP_TIMEZONE noto'g'ri (${configured}); ${DEFAULT_TIME_ZONE} ishlatiladi.`
    );
    return DEFAULT_TIME_ZONE;
  }
}

export const APP_TIME_ZONE = getTimeZone();

export function dateTimeInAppTimeZone(date = new Date()): {
  date: string;
  time: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const hours = Number(values.hour);
  const minutes = Number(values.minute);

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  };
}

export function todayDateISO(): string {
  return dateTimeInAppTimeZone().date;
}
