// 장소 검색 공용 로직.
//
// 이전에는 MapContainer 와 TourRouteEditor 가 각자 AutocompleteService /
// PlacesService 를 직접 호출했다. 두 구현이 미묘하게 달라(사전 등록 장소
// 폴백 유무, 결과 개수) 같은 검색어에도 화면마다 다른 결과가 나왔다.
//
// 예측 항목은 두 형태 중 하나다.
//   { type: 'preset', name }                       사전 등록 장소
//   { type: 'google', placeId, label, description } 구글 검색 결과

import {
  getSearchCandidates,
  normalizeSearchTerm,
  extractPredictionLabel,
  resolveCoord,
} from '@/lib/placeUtils.js'

const DEFAULT_LIMIT = 12
const EMPTY_QUERY_LIMIT = 8

/**
 * 사전 등록 장소에서 검색어에 맞는 항목을 고른다.
 * 구글이 못 찾는 한국어 지명(예: "켄과 메리 나무")을 잡아주는 폴백이다.
 */
function matchPresets(query, presetNames) {
  return presetNames
    .map((name) => ({ name, terms: getSearchCandidates(name) }))
    .filter((entry) => entry.terms.some((term) => term.includes(query)))
    .map((entry) => ({ type: 'preset', name: entry.name }))
}

/**
 * 검색어에 대한 예측 목록을 만들어 onResult 로 넘긴다.
 * 구글 SDK 가 없거나 실패해도 사전 등록 장소 결과는 항상 돌려준다.
 *
 * @param {string} value 사용자가 입력한 검색어
 * @param {string[]} presetNames 폴백으로 쓸 사전 등록 장소 이름
 * @param {(items: Array) => void} onResult
 * @param {{ limit?: number }} [options]
 */
export function fetchPlacePredictions(value, presetNames, onResult, { limit = DEFAULT_LIMIT } = {}) {
  const names = presetNames || []
  const query = normalizeSearchTerm(value)

  // 입력이 비어 있으면 추천 목록을 보여준다.
  if (!query) {
    onResult(names.slice(0, EMPTY_QUERY_LIMIT).map((name) => ({ type: 'preset', name })))
    return
  }

  const fallback = matchPresets(query, names)

  if (!window.google?.maps?.places?.AutocompleteService) {
    onResult(fallback.slice(0, limit))
    return
  }

  new window.google.maps.places.AutocompleteService().getPlacePredictions(
    {
      input: value,
      componentRestrictions: { country: 'jp' },
    },
    (predictions, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
        onResult(fallback.slice(0, limit))
        return
      }

      const merged = [...fallback]
      predictions
        .map((prediction) => ({
          type: 'google',
          placeId: prediction.place_id,
          label: extractPredictionLabel(prediction),
          description: prediction.description || '',
        }))
        .forEach((item) => {
          const isDuplicate = merged.some(
            (existing) => normalizeSearchTerm(existing.name || existing.label) === normalizeSearchTerm(item.label),
          )
          if (!isDuplicate) merged.push(item)
        })

      onResult(merged.slice(0, limit))
    },
  )
}

/**
 * 예측 항목 하나를 { name, coord } 로 확정한다.
 * preset 은 좌표 사전에서 즉시 해결되고, google 항목만 상세 조회가 필요하다.
 *
 * @param {object} prediction
 * @param {google.maps.Map | null} mapNode PlacesService 에 필요한 지도 인스턴스
 * @returns {Promise<{ name: string, coord: {lat: number, lng: number} | null } | null>}
 */
export function resolvePrediction(prediction, mapNode) {
  if (!prediction) return Promise.resolve(null)

  if (prediction.type === 'preset') {
    return Promise.resolve({ name: prediction.name, coord: resolveCoord(prediction.name) })
  }

  if (!window.google?.maps?.places?.PlacesService || !mapNode) {
    // SDK 나 지도가 없으면 좌표 없이 이름만 확정한다.
    return Promise.resolve({ name: prediction.label || prediction.description, coord: null })
  }

  return new Promise((resolve) => {
    new window.google.maps.places.PlacesService(mapNode).getDetails(
      { placeId: prediction.placeId, fields: ['name', 'geometry'] },
      (place) => {
        const name = place?.name || prediction.label || prediction.description
        const location = place?.geometry?.location
        if (!location) {
          resolve({ name, coord: null })
          return
        }
        resolve({ name, coord: { lat: location.lat(), lng: location.lng() } })
      },
    )
  })
}
