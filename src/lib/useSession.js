'use client'

import { useEffect, useState } from 'react'
import { readSession, subscribeSession } from '@/lib/session.js'

const SIGNED_OUT = { isLoggedIn: false, nickname: '', user: null, settled: false }

/**
 * 로그인 상태를 구독한다.
 *
 * 첫 렌더는 항상 "로그아웃, 아직 미확정" 이다. 서버 렌더 결과와 같아야
 * 하이드레이션이 어긋나지 않기 때문이다. 마운트 직후 실제 상태로 맞춘다.
 *
 * settled 는 "서버에 한 번 물어봤다" 는 뜻이다. 이게 false 인 동안 화면은
 * 로그인 안내를 띄우면 안 된다. 로그인한 사람에게도 새로고침할 때마다
 * "로그인이 필요합니다" 가 잠깐 스쳐 지나가게 된다.
 */
export function useSession() {
  const [state, setState] = useState(SIGNED_OUT)

  useEffect(() => {
    const sync = () => setState(readSession())
    sync()
    return subscribeSession(sync)
  }, [])

  return state
}
