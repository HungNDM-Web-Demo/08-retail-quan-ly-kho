/** Đường dẫn FE (kebab-case). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  dashboard: '/dashboard',

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const

export type RoutePath = (typeof routePath)[keyof typeof routePath]
