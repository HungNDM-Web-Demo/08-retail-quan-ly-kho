import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import Script from 'next/script'
import NextTopLoader from 'nextjs-toploader'
import { appConfig } from '@/config/app.config'
import { getPublicSettingsServer } from '@/features/settings/services/setting.server'
import { BRAND_VARS_STORAGE_KEY } from '@/lib/brand-color'
import { Providers } from '@/lib/providers'
import './index.css'

/** Be Vietnam Pro: thiết kế riêng cho dấu tiếng Việt (KIEN-TRUC-HE-THONG §6.5) */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettingsServer()
  const name = settings['Brand.AppName'] || appConfig.name
  return {
    title: { default: name, template: `%s · ${name}` },
    description: appConfig.slogan,
    applicationName: name,
    icons: { icon: appConfig.logoUrl },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
}

/** Gán lại màu thương hiệu đã lưu trước khi trang hiện, tránh chớp từ màu mặc định sang màu khách. */
const brandBootScript = `try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(BRAND_VARS_STORAGE_KEY)})||'null');if(v){for(var k in v){document.documentElement.style.setProperty(k,v[k])}}}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnamPro.variable} suppressHydrationWarning>
      <head>
        {/* beforeInteractive: chạy trước khi trang hiện; không render thẻ <script> trong cây React phía trình duyệt
            (thẻ script thường gây lỗi "Encountered a script tag" khi Next render lại layout ở trang 404) */}
        <Script id="brand-boot" strategy="beforeInteractive">
          {brandBootScript}
        </Script>
      </head>
      <body className="min-h-svh font-sans antialiased">
        <NextTopLoader color="var(--primary)" height={3} showSpinner={false} shadow={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
