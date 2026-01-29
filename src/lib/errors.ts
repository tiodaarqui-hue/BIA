/**
 * Error codes for API responses
 * Format: { error: message, code: ERROR_CODE }
 */

export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // Auth
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  PHONE_NOT_FOUND: "PHONE_NOT_FOUND",
  ACCOUNT_NO_PASSWORD: "ACCOUNT_NO_PASSWORD",
  PHONE_ALREADY_EXISTS: "PHONE_ALREADY_EXISTS",

  // Booking
  SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
  NO_BARBERS_AVAILABLE: "NO_BARBERS_AVAILABLE",
  BARBER_NOT_AVAILABLE: "BARBER_NOT_AVAILABLE",
  SLOT_CONFLICT: "SLOT_CONFLICT",
  DAY_NOT_AVAILABLE: "DAY_NOT_AVAILABLE",

  // Appointment
  APPOINTMENT_NOT_FOUND: "APPOINTMENT_NOT_FOUND",
  APPOINTMENT_ALREADY_CANCELLED: "APPOINTMENT_ALREADY_CANCELLED",
  CANCEL_TOO_LATE: "CANCEL_TOO_LATE",

  // General
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a standardized error response
 */
export function createError(code: ErrorCode, message: string) {
  return { error: message, code };
}
