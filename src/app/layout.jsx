import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navigation from '@/components/Navigation'

export const metadata = {
  title: '잽코 택시투어 — 비에이·후라노 전문 택시투어',
  description: '홋카이도 비에이·후라노 지역 전문 택시투어. 현지 가이드와 함께하는 맞춤형 당일 투어.',
  openGraph: {
    siteName: '잽코 택시투어',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Navigation />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
