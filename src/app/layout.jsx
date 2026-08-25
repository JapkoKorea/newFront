import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer.jsx'
import { SITE_URL } from '@/lib/site.js'

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
        <Navigation />
        {children}
        <Footer />
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
