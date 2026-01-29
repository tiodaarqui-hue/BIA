import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Formats phone to WhatsApp Brazil standard: +5562999990001
 * Accepts: 62999990001, 5562999990001, +5562999990001, (62) 99999-0001
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // 11 digits: DDD + number (e.g., 62999990001)
  if (digits.length === 11) {
    return `+55${digits}`;
  }

  // 13 digits with country code (e.g., 5562999990001)
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits}`;
  }

  // Return with +55 prefix as fallback
  return `+55${digits}`;
}

/**
 * Validates Brazilian phone number for WhatsApp
 * Format: DDD (2 digits) + 9-digit mobile number
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const digits = phone.replace(/\D/g, "");

  // Accept 11 digits (DDD + number) or 13 digits (55 + DDD + number)
  if (digits.length === 11) {
    return { valid: true };
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return { valid: true };
  }

  return {
    valid: false,
    error: "Telefone deve ter DDD + 9 dígitos (ex: 62999990001)"
  };
}
