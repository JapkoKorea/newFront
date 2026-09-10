'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { bootstrapSession } from '@/lib/session.js'

/**
 * 전역 셸 상태.
 *
 * 두 가지를 공유한다.
 *
 * 1. 하단 고정 액션 바가 있는지. 상품 상세처럼 하단 바를 쓰는 화면에서는
 *    Navigation 의 플로팅 버튼이 그 위에 겹쳐서 1차 액션을 가려 버린다.
 *    화면이 스스로 선언하면 Navigation 이 플로팅 버튼을 접는다.
 * 2. 상담/FAQ 모달을 여는 함수. 모달 자체는 Navigation 이 한 번만 마운트하고,
 *    하단 바 같은 다른 화면 요소도 같은 모달을 열 수 있어야 한다.
 */
const AppShellContext = createContext(null)

export function AppShellProvider({ children }) {
  // 하단 바를 선언한 화면 수. 전환 중 잠깐 둘이 겹칠 수 있어 boolean 이 아니라 카운터다.
  const [bottomBarCount, setBottomBarCount] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isFAQOpen, setIsFAQOpen] = useState(false)

  // 액세스 토큰은 메모리에만 있어서 새로고침하면 사라진다. 앱이 뜨자마자
  // 리프레시 쿠키로 한 번 복구한다. 여기 말고 다른 데서 하면 화면마다
  // 제각기 부르게 되고, 셸은 모든 페이지에 한 번씩만 마운트된다.
  useEffect(() => {
    bootstrapSession()
  }, [])

  const registerBottomBar = useCallback(() => {
    setBottomBarCount((n) => n + 1)
    return () => setBottomBarCount((n) => Math.max(0, n - 1))
  }, [])

  // 상담과 FAQ 는 동시에 뜨면 안 된다.
  const openChat = useCallback(() => {
    setIsFAQOpen(false)
    setIsChatOpen(true)
  }, [])
  const openFAQ = useCallback(() => {
    setIsChatOpen(false)
    setIsFAQOpen(true)
  }, [])
  const closeChat = useCallback(() => setIsChatOpen(false), [])
  const closeFAQ = useCallback(() => setIsFAQOpen(false), [])

  const value = useMemo(
    () => ({
      hasBottomBar: bottomBarCount > 0,
      registerBottomBar,
      isChatOpen,
      isFAQOpen,
      openChat,
      openFAQ,
      closeChat,
      closeFAQ,
    }),
    [bottomBarCount, registerBottomBar, isChatOpen, isFAQOpen, openChat, openFAQ, closeChat, closeFAQ],
  )

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell 은 AppShellProvider 안에서만 쓸 수 있습니다.')
  return ctx
}

/** 이 화면에 하단 고정 액션 바가 있다고 알린다. 마운트되어 있는 동안만 유효하다. */
export function useDeclareBottomBar() {
  const { registerBottomBar } = useAppShell()
  useEffect(() => registerBottomBar(), [registerBottomBar])
}
