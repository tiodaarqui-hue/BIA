/**
 * Timezone utilities for Brazil (UTC-3)
 * Note: Brazil abolished DST in 2019, so UTC-3 is now fixed year-round
 */

export interface BrazilTime {
  hours: number;
  minutes: number;
  dayOfWeek: number;
  dateStr: string; // YYYY-MM-DD
}

/**
 * Convert any Date to Brazil timezone (UTC-3)
 * Works regardless of server timezone
 */
export function toBrazilTime(date: Date): BrazilTime {
  const BRAZIL_TZ_OFFSET = 180; // UTC-3 expressed as getTimezoneOffset() = +180 minutes
  const localOffset = date.getTimezoneOffset();
  const brazilDate = new Date(date.getTime() + (localOffset - BRAZIL_TZ_OFFSET) * 60000);

  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, "0");
  const day = String(brazilDate.getDate()).padStart(2, "0");

  return {
    hours: brazilDate.getHours(),
    minutes: brazilDate.getMinutes(),
    dayOfWeek: brazilDate.getDay(),
    dateStr: `${year}-${month}-${day}`,
  };
}

/**
 * Create a Date in UTC from a Brazil date string and time
 * @param dateStr - Date in YYYY-MM-DD format (Brazil date)
 * @param hours - Hour in Brazil time (0-23)
 * @param minutes - Minutes (0-59)
 * @returns Date object in UTC
 */
export function brazilTimeToUtc(dateStr: string, hours: number, minutes: number): Date {
  // Format: YYYY-MM-DDTHH:MM:SS-03:00 (Brazil timezone)
  const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
  return new Date(`${dateStr}T${timeStr}-03:00`);
}

/**
 * Get start and end of day in Brazil timezone as UTC dates
 * Useful for database queries
 */
export function getBrazilDayRange(dateStr: string): { startUtc: Date; endUtc: Date } {
  return {
    startUtc: new Date(`${dateStr}T00:00:00-03:00`),
    endUtc: new Date(`${dateStr}T23:59:59-03:00`),
  };
}
