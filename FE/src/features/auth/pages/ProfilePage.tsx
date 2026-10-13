'use client'

import { AtSign, KeyRound, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoleLabel } from '@/features/demo/hooks/use-demo'
import { usePermissions } from '@/hooks/use-permissions'
import { formatPhone } from '@/lib/format'
import { ChangePasswordForm } from '../components/ChangePasswordForm'

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

/** SCR-SYS-08: hồ sơ cá nhân, đổi mật khẩu. */
export function ProfilePage() {
  const { user, roles, isSuperAdmin } = usePermissions()
  const roleLabel = useRoleLabel()
  if (!user) return null

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ cá nhân" description="Thông tin tài khoản và mật khẩu đăng nhập." icon={UserRound} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-2 text-center">
            <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="lg" />
            <div>
              <p className="text-lg font-semibold">{user.fullName}</p>
              <p className="text-muted-foreground text-sm">@{user.username}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {roles.map((code) => (
                <StatusBadge key={code} tone="primary">
                  {roleLabel(code)}
                </StatusBadge>
              ))}
              {user.isDemoAccount && <StatusBadge tone="warning">Tài khoản demo</StatusBadge>}
            </div>
          </CardContent>
          <CardContent>
            <dl className="divide-y border-t">
              <InfoRow icon={AtSign} label="Tên đăng nhập" value={user.username} />
              <InfoRow icon={Mail} label="Email" value={user.email || 'Chưa có'} />
              <InfoRow icon={Phone} label="Số điện thoại" value={formatPhone(user.phone, 'Chưa có')} />
              <InfoRow
                icon={ShieldCheck}
                label="Quyền"
                value={isSuperAdmin ? 'Toàn quyền hệ thống' : `${user.permissions.length} quyền được cấp`}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="text-primary size-4" aria-hidden="true" />
              Đổi mật khẩu
            </CardTitle>
            <CardDescription>Dùng mật khẩu mạnh, không trùng với mật khẩu ở nơi khác.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-xl">
            <ChangePasswordForm disabled={user.isDemoAccount} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
