'use client'

import { useJsApiLoader } from '@react-google-maps/api'
import { MAPS_LIBRARIES } from '@/lib/placeUtils.js'

// 지도 스크립트 로더를 한 곳에서 만든다.
//
// useLoadScript 를 쓰면 지도가 스피너에서 멈추는 일이 있었다. 그 훅은
// 언마운트할 때 주입한 <script> 를 다시 떼어내는데, React StrictMode 는
// 개발 중 컴포넌트를 마운트-언마운트-마운트 시킨다. 로딩 중이던 스크립트가
// 중간에 제거되면 실행되지 못하고, 다시 마운트됐을 때 로더는 "이미 주입함"
// 으로 판단해 아무것도 하지 않는다. window.google 이 끝내 생기지 않아
// isLoaded 가 false 로 남고 화면은 계속 "지도 로딩 중..." 이 된다.
//
// useJsApiLoader 는 스크립트를 떼어내지 않고 로드 상태를 모듈 단위로
// 공유해서 이 경우를 견딘다. 라이브러리가 권장하는 방식이기도 하다.
//
// id 를 고정해 두 화면(MapContainer, TourRouteEditor)이 같은 스크립트를
// 나눠 쓰게 한다. 설정이 서로 다르면 로더가 경고를 내고 한쪽이 멈춘다.
const LOADER_ID = 'japko-google-maps'

export function useMapsLoader() {
  return useJsApiLoader({
    id: LOADER_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
    libraries: MAPS_LIBRARIES,
  })
}
