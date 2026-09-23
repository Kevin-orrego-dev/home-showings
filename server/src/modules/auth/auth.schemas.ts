import { z } from 'zod';

// zod schemas are the single source of truth for request shapes:
// they validate at runtime AND give us the TypeScript types for free.

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72), // bcrypt ignores bytes past 72
  role: z.enum(['seller', 'buyer']),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
