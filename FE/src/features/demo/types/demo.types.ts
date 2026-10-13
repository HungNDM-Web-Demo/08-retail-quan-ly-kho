/** DTO demo, khớp QUY-UOC-API §4.2. */

/** GET /api/demo/accounts: thứ tự hiển thị trên trang đăng nhập */
export type DemoAccount = {
  username: string
  fullName: string
  roleCode: string
  roleName: string
  /** Vai trò này dùng để xem gì */
  description: string
}

/** POST /api/demo/login-as → AuthResponse */
export type LoginAsRequest = { roleCode: string }
