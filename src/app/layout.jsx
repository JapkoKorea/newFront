import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer.jsx'
import { AppShellProvider } from '@/lib/appShell.jsx'
import { SITE_URL } from '@/lib/site.js'

// viewportFit: 'cover' 가 있어야 env(safe-area-inset-*) 값이 0 이 아닌 실제 값으로 들어온다.
// 홈 인디케이터가 있는 기기에서 하단 고정 요소가 제스처 바에 깔리는 것을 막기 위해 필요하다.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export const metadata = {
  // metadataBase 가 있어야 OG 이미지와 canonical 이 절대 URL 로 생성된다.
  metadataBase: new URL(SITE_URL),
  title: {
    default: '잽코 택시투어 — 비에이·후라노 전문 택시투어',
    template: '%s | 잽코 택시투어',
  },
  description: '홋카이도 비에이·후라노 지역 전문 택시투어. 현지 가이드와 함께하는 맞춤형 당일 투어.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    siteName: '잽코 택시투어',
    title: '잽코 택시투어 — 비에이·후라노 전문 택시투어',
    description: '홋카이도 비에이·후라노 지역 전문 택시투어. 현지 가이드와 함께하는 맞춤형 당일 투어.',
    url: '/',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '잽코 택시투어',
    description: '홋카이도 비에이·후라노 지역 전문 택시투어.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <AppShellProvider>
          <Navigation />
          {children}
          <Footer />
          <Toaster position="top-center" />
        </AppShellProvider>
      </body>
    </html>
  )
}
