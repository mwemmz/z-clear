import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(1).max(200),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export interface UserProfile {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}
