/** Endpoint BE (QUY-UOC-API §3). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },
} as const
