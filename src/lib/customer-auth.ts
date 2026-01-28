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

export function formatPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Ensure it has country code
  if (digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits}`;
  }
  return digits;
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // Brazilian phone: 11 digits (2 DDD + 9 phone) or 13 with country code
  return digits.length === 11 || (digits.length === 13 && digits.startsWith("55"));
}
