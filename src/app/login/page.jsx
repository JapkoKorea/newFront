'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoginKakaoButton from '@/components/LoginKakao.jsx'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

function LoginCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return

    const handleKakaoCallback = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/kakao/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        if (!response.ok) throw new Error('로그인 실패')

        const data = await response.json()
        const token = data?.token || data?.access_token
        if (token) {
          localStorage.setItem('jwt', token)
          if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
        }
        router.push('/')
      } catch (err) {
        console.error('카카오 로그인 오류:', err)
        router.push('/')
      }
    }

    handleKakaoCallback()
  }, [searchParams, router])

  return null
}

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">카카오 로그인</h2>
      <LoginKakaoButton />
      <Suspense fallback={null}>
        <LoginCallbackHandler />
      </Suspense>
    </div>
  )
}
