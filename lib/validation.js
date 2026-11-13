
import { z } from "zod";

const dateField = z
  .string()
  .min(1, "Choose a date and time.")
  .refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    "Enter a valid date and time."
  );

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const requestSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Add an item name."),
        quantity: z.coerce.number().int().min(1).max(99),
      })
    )
    .min(1, "Add at least one laundry item."),
  pickupAt: dateField,
  dropOffAt: dateField,
  expectedAt: dateField,
  notes: z.string().trim().max(500).optional(),
});

export const disputeSchema = z.object({
  requestId: z.string().min(1),
  type: z.string().trim().min(1, "Choose an issue type."),
  description: z
    .string()
    .trim()
    .min(8, "Describe the issue in a little more detail.")
    .max(1000),
});

// New registration validation
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
  studentId: z.string().trim().toUpperCase().min(3).max(30),
  hostel: z.string().trim().min(2).max(60),
  room: z.string().trim().min(1).max(20),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s()-]{5,18}[0-9]$/),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer.")
    .regex(/[A-Za-z]/, "Password must include at least one letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
});
