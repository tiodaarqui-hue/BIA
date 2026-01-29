import { z } from "zod";

// Brazilian mobile phone validation
// Accepts various formats: 62999990001, (62) 99999-0001, +5562999990001
export const phoneSchema = z.string()
  .min(10, "Telefone muito curto")
  .max(20, "Telefone muito longo")
  .transform((val) => val.replace(/\D/g, "")) // Strip to digits only
  .refine((digits) => {
    // Accept 11 digits (DDD + 9-digit mobile) or 13 digits (55 + DDD + 9-digit)
    if (digits.length === 11) return true;
    if (digits.length === 13 && digits.startsWith("55")) return true;
    return false;
  }, {
    message: "Telefone deve ter DDD + 9 dígitos (ex: 62999990001)",
  });
export const uuidSchema = z.string().uuid("ID inválido");
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM");

// Customer registration
export const customerRegisterSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  phone: phoneSchema,
  password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
  barbershopId: uuidSchema,
});

// Customer login
export const customerLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Senha é obrigatória"),
  barbershopId: uuidSchema,
});

// Booking (multi-service support)
export const bookingSchema = z.object({
  customerId: uuidSchema,
  barberId: uuidSchema.nullable().optional(),
  serviceIds: z.array(uuidSchema).min(1, "Selecione pelo menos um serviço"),
  scheduledAt: z.string().datetime("Data/hora inválida"),
  barbershopId: uuidSchema,
});

// Cancel appointment
export const cancelSchema = z.object({
  appointmentId: uuidSchema,
  customerId: uuidSchema,
});

// Slots query params
export const slotsQuerySchema = z.object({
  barbershopId: uuidSchema,
  date: dateSchema,
  barberId: uuidSchema.optional(),
  duration: z.coerce.number().int().min(5).max(480).default(30),
});

// Helper to validate and return typed result or error response
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      success: false,
      error: `${firstError.path.join(".")}: ${firstError.message}`
    };
  }
  return { success: true, data: result.data };
}
