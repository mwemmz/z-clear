export const ROLES = ['agency_owner', 'agent_staff', 'client_viewer', 'platform_admin'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
