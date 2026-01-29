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
  const brazilOffset = -3 * 60; // UTC-3 in minutes
  const localOffset = date.getTimezoneOffset();
  const brazilDate = new Date(date.getTime() + (localOffset - brazilOffset) * 60000);

  return {
    hours: brazilDate.getHours(),
    minutes: brazilDate.getMinutes(),
    dayOfWeek: brazilDate.getDay(),
    dateStr: brazilDate.toISOString().split("T")[0],
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
