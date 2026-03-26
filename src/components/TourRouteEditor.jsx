'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useLoadScript, GoogleMap, DirectionsRenderer, Polyline } from '@react-google-maps/api'
import { COORDS_DICT } from '@/components/MapContainer.jsx'
import MarkerWithLabel from '@/components/MarkerWithLabel.jsx'
import { GripVertical, Clock, Camera, Search, X } from 'lucide-react'

const LIBRARIES = ['places']
const CENTER_BIEI = { lat: 43.5913, lng: 142.4622 }
const STATION_CHIPS = ['아사히카와역', '비에이역', '지요가오카역', '후라노역']

function makePlace(name) {
  return { name: name || '', coord: COORDS_DICT[name] || null }
}

// 경로 상의 중복 좌표 제거 (출발지=첫 명소, 마지막 명소=도착지 등)
function dedupeSequential(points) {
  return points.reduce((acc, p) => {
    if (!p) return acc
    const prev = acc[acc.length - 1]
    if (prev && prev.lat === p.lat && prev.lng === p.lng) return acc
    return [...acc, p]
  }, [])
}

export default function TourRouteEditor({ initialDeparture, initialDestination, initialSpots, spotGuideData }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef(null)
  const debounceRef = useRef(null)

  const [departure, setDeparture] = useState(() => makePlace(initialDeparture))
  const [destination, setDestination] = useState(() => makePlace(initialDestination))
  const [spots, setSpots] = useState(initialSpots || [])

  const [depInput, setDepInput] = useState('')
  const [destInput, setDestInput] = useState('')
  const [depPredictions, setDepPredictions] = useState([])
  const [destPredictions, setDestPredictions] = useState([])

  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // 경로 결과: DirectionsResult (성공) | null (폴백용 직선)
  const [directionsResult, setDirectionsResult] = useState(null)

  // ── 좌표 계산 ────────────────────────────────────────────────
  const depCoord = departure.coord || COORDS_DICT[departure.name] || null
  const destCoord = destination.coord || COORDS_DICT[destination.name] || null
  const spotCoords = spots.map(s => COORDS_DICT[s] || null)

  // 폴백용 직선 경로 (DirectionsService 실패 시)
  const fallbackRoute = dedupeSequential([
    depCoord,
    ...spotCoords,
    destCoord,
  ])

  // 지도 중심
  const allCoords = [depCoord, ...spotCoords, destCoord].filter(Boolean)
  const center = allCoords.length > 0
    ? { lat: allCoords.reduce((s, p) => s + p.lat, 0) / allCoords.length, lng: allCoords.reduce((s, p) => s + p.lng, 0) / allCoords.length }
    : CENTER_BIEI

  // ── Directions API 호출 (디바운싱) ────────────────────────────
  useEffect(() => {
    if (!isLoaded || !depCoord || !destCoord) {
      setDirectionsResult(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const waypoints = spotCoords
        .filter(Boolean)
        .map(coord => ({ location: coord, stopover: true }))

      new window.google.maps.DirectionsService().route(
        {
          origin: depCoord,
          destination: destCoord,
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false, // 사용자 지정 순서 유지
        },
        (result, status) => {
          setDirectionsResult(status === 'OK' ? result : null)
        }
      )
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, departure.name, departure.coord, destination.name, destination.coord, spots.join(',')])

  // ── Places 검색 ───────────────────────────────────────────────
  const fetchPredictions = useCallback((value, setPredictions) => {
    if (!value || value.trim().length < 2 || !window.google?.maps?.places?.AutocompleteService) {
      setPredictions([])
      return
    }
    new window.google.maps.places.AutocompleteService().getPlacePredictions(
      { input: value, componentRestrictions: { country: 'jp' } },
      (predictions, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setPredictions([]); return
        }
        setPredictions(predictions.slice(0, 5))
      }
    )
  }, [])

  const selectPrediction = useCallback((prediction, setPlace, setInput, setPredictions) => {
    if (!window.google?.maps?.places?.PlacesService || !mapRef.current) {
      setPlace({ name: prediction.description, coord: null })
      setInput(''); setPredictions([]); return
    }
    new window.google.maps.places.PlacesService(mapRef.current).getDetails(
      { placeId: prediction.place_id, fields: ['name', 'geometry'] },
      (place) => {
        const name = place?.name || prediction.structured_formatting?.main_text || prediction.description
        const loc = place?.geometry?.location
        const coord = loc ? { lat: loc.lat(), lng: loc.lng() } : null
        setPlace({ name, coord })
        if (coord && mapRef.current) { mapRef.current.panTo(coord); mapRef.current.setZoom(13) }
        setInput(''); setPredictions([])
      }
    )
  }, [])

  // ── 드래그 ────────────────────────────────────────────────────
  const handleDragStart = (i) => setDraggedIndex(i)
  const handleDragOver = (e, i) => { e.preventDefault(); setDragOverIndex(i) }
  const handleDrop = (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null); setDragOverIndex(null); return
    }
    const next = [...spots]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(dropIndex, 0, moved)
    setSpots(next)
    setDraggedIndex(null); setDragOverIndex(null)
  }
  const handleDragEnd = () => { setDraggedIndex(null); setDragOverIndex(null) }

  // ── 초기화 ────────────────────────────────────────────────────
  const isDirty = departure.name !== initialDeparture || destination.name !== initialDestination || spots.join(',') !== (initialSpots || []).join(',')
  const handleReset = () => {
    setDeparture(makePlace(initialDeparture))
    setDestination(makePlace(initialDestination))
    setSpots(initialSpots || [])
    setDepInput(''); setDestInput('')
    setDepPredictions([]); setDestPredictions([])
  }

  // ── 마커 표시 여부 결정 ──────────────────────────────────────
  // 출발=도착이면 도착 마커 별도 표시 안 함 (동일 위치 중복 방지)
  const showDestMarker = destCoord && !(destCoord.lat === depCoord?.lat && destCoord.lng === depCoord?.lng)
  // 명소가 출발지/도착지와 동일 좌표면 마커 skip
  const isOverlap = (coord) =>
    (depCoord && coord.lat === depCoord.lat && coord.lng === depCoord.lng) ||
    (destCoord && coord.lat === destCoord.lat && coord.lng === destCoord.lng)

  const placeFields = [
    { label: '출발지', place: departure, setPlace: setDeparture, input: depInput, setInput: setDepInput, predictions: depPredictions, setPredictions: setDepPredictions },
    { label: '도착지', place: destination, setPlace: setDestination, input: destInput, setInput: setDestInput, predictions: destPredictions, setPredictions: setDestPredictions },
  ]

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">투어 루트</h2>
        {isDirty && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>
        )}
      </div>

      {/* 출발지 / 도착지 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {placeFields.map(({ label, place, setPlace, input, setInput, predictions, setPredictions }) => (
          <div key={label}>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
            {place.name && (
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-sm font-medium text-gray-800 truncate">{place.name}</span>
                <button onClick={() => { setPlace({ name: '', coord: null }); setInput('') }} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={input}
                placeholder="장소 검색..."
                onChange={(e) => { setInput(e.target.value); if (isLoaded) fetchPredictions(e.target.value, setPredictions) }}
                className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              {predictions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                  {predictions.map((p) => (
                    <button
                      key={p.place_id}
                      onMouseDown={() => selectPrediction(p, setPlace, setInput, setPredictions)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 border-b last:border-b-0"
                    >
                      <p className="font-medium text-gray-800 truncate">{p.structured_formatting?.main_text || p.description}</p>
                      <p className="text-xs text-gray-400 truncate">{p.structured_formatting?.secondary_text || ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {STATION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setPlace({ name: chip, coord: COORDS_DICT[chip] || null })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    place.name === chip ? 'bg-yellow-500 border-yellow-500 text-white font-medium' : 'border-gray-200 text-gray-600 hover:border-yellow-400'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 지도 */}
      <div className="h-72 rounded-xl overflow-hidden border bg-gray-100">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={11}
            onLoad={(map) => { mapRef.current = map }}
            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
          >
            {/* 실제 도로 경로 (DirectionsRenderer) */}
            {directionsResult ? (
              <DirectionsRenderer
                directions={directionsResult}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: { strokeColor: '#EAB308', strokeWeight: 3, strokeOpacity: 0.85 },
                }}
              />
            ) : (
              /* 폴백: 직선 */
              fallbackRoute.length > 1 && (
                <Polyline path={fallbackRoute} options={{ strokeColor: '#EAB308', strokeWeight: 3, strokeOpacity: 0.85 }} />
              )
            )}

            {/* 마커 */}
            {depCoord && <MarkerWithLabel position={depCoord} label="출발" color="#22c55e" isHovered={false} />}
            {spots.map((spot, i) => {
              const coord = spotCoords[i]
              if (!coord || isOverlap(coord)) return null
              return <MarkerWithLabel key={`spot-${i}`} position={coord} label={String(i + 1)} color="#f59e0b" isHovered={false} />
            })}
            {showDestMarker && <MarkerWithLabel position={destCoord} label="도착" color="#ef4444" isHovered={false} />}
          </GoogleMap>
        ) : (
          <div className="h-full flex items-center justify-center animate-pulse">
            <p className="text-sm text-gray-400">지도 로딩 중...</p>
          </div>
        )}
      </div>

      {/* 명소 목록 (드래그 순서 변경) */}
      {spots.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">
            방문 명소 <span className="font-normal text-gray-400">— 드래그로 순서 변경</span>
          </p>
          <div className="space-y-2">
            {spots.map((spot, index) => {
              const guide = spotGuideData?.[spot]
              return (
                <div
                  key={`${spot}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex gap-3 p-3 border rounded-lg bg-white cursor-move transition-colors select-none ${
                    dragOverIndex === index ? 'ring-2 ring-yellow-400 bg-yellow-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center text-gray-300 shrink-0">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{spot}</p>
                    {guide && (
                      <div className="mt-0.5 space-y-0.5">
                        {guide.stayMinutes && (
                          <p className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />체류 약 {guide.stayMinutes}분
                          </p>
                        )}
                        {guide.photoPoint && (
                          <p className="flex items-start gap-1 text-xs text-gray-500">
                            <Camera className="h-3 w-3 mt-0.5 shrink-0" />{guide.photoPoint}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
