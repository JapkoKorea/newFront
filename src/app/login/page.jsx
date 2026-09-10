'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoginKakaoButton from '@/components/LoginKakao.jsx'
import { API_BASE_URL } from '@/lib/api.js'
import { setSession } from '@/lib/session.js'

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
          // 서버가 리프레시 쿠키를 심는 응답이다. 이게 없으면 쿠키가 버려지고
          // 30분 뒤 로그인이 풀린다.
          credentials: 'include',
          body: JSON.stringify({ code }),
        })

        if (!response.ok) throw new Error('로그인 실패')

        const data = await response.json()
        const token = data?.token || data?.access_token
        if (token) {
          setSession({ token, user: data.user || null, expiresIn: data.expires_in })
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
