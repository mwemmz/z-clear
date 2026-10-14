import { z } from 'zod';
import { ROLES } from '../../common/roles';

const password = z.string().min(12, 'Password must be at least 12 characters').max(200);

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password,
    role: z.enum(ROLES),
  })
  .strict();

export const updateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    password,
  })
  .partial()
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}
