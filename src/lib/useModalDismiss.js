'use client'

import { useEffect, useRef } from 'react'

/**
 * 모달을 ESC 와 바깥 클릭으로 닫는다.
 *
 * 바깥 클릭 판정은 mousedown 과 mouseup 이 **모두** 오버레이에서 일어났을
 * 때만 닫는다. 모달 안에서 글을 드래그로 선택하다가 손을 바깥에서 떼는
 * 경우가 흔한데, click 만 보면 그때도 닫혀서 쓰던 내용이 날아간다.
 *
 * 반환한 props 는 오버레이(전체 화면을 덮는 요소)에 펼쳐 넣는다.
 *   const overlay = useModalDismiss(isOpen, onClose)
 *   <div className="fixed inset-0 ..." {...overlay}>
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {{ closeOnEsc?: boolean, closeOnOutside?: boolean }} [options]
 */
export function useModalDismiss(isOpen, onClose, options = {}) {
  const { closeOnEsc = true, closeOnOutside = true } = options
  const pressedOnOverlay = useRef(false)

  useEffect(() => {
    if (!isOpen || !closeOnEsc || typeof onClose !== 'function') return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, closeOnEsc, onClose])

  if (!closeOnOutside || typeof onClose !== 'function') return {}

  return {
    onMouseDown: (event) => {
      pressedOnOverlay.current = event.target === event.currentTarget
    },
    onMouseUp: (event) => {
      const outside = pressedOnOverlay.current && event.target === event.currentTarget
      pressedOnOverlay.current = false
      if (outside) onClose()
    },
  }
}
