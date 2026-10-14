import { z } from 'zod';

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export interface TenantSummary {
  id: string;
  name: string;
  isActive: boolean;
}
