'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { LogIn, X } from 'lucide-react'
import { signOut } from '@/lib/session.js'

/**
 * 로그인이 풀렸을 때 띄우는 알림.
 *
 * 전에는 작은 빨간 글씨로만 나와서 놓치기 쉬웠다. 로그인이 풀리면 그 화면에서
 * 할 수 있는 일이 없으므로, 확실히 막아 세우고 로그인으로 보낸다.
 *
 * 남아 있는 세션은 서버까지 정리한다. 여기까지 왔다는 건 갱신도 실패했다는
 * 뜻이라 쿠키를 남겨 둘 이유가 없다.
 */
export default function SessionExpiredDialog({ isOpen, message, onClose }) {
  const router = useRouter()

  useEffect(() => {
    if (!isOpen) return
    signOut()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">로그인이 필요합니다</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-sm text-gray-700">
          {message || '로그인이 만료되었습니다. 다시 로그인해 주세요.'}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          입력하신 예약 정보는 그대로 있습니다. 로그인 후 이어서 진행하실 수 있습니다.
        </p>

        <div className="mt-5 flex gap-2">
          <Button
            className="flex-1 bg-yellow-500 hover:bg-yellow-600"
            onClick={() => router.push('/login')}
          >
            <LogIn className="mr-1 h-4 w-4" />
            카카오 로그인
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push('/')}>
            홈으로
          </Button>
        </div>
      </div>
    </div>
  )
}
