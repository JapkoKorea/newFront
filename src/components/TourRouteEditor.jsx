'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api'
import { COORDS_DICT } from '@/components/MapContainer.jsx'
import MarkerWithLabel from '@/components/MarkerWithLabel.jsx'
import { GripVertical, Clock, Camera, Search, X } from 'lucide-react'

const LIBRARIES = ['places']
const CENTER_BIEI = { lat: 43.5913, lng: 142.4622 }
const STATION_CHIPS = ['아사히카와역', '비에이역', '지요가오카역', '후라노역']
const WAYPOINT_SUGGESTIONS = Object.keys(COORDS_DICT).filter((name) => !STATION_CHIPS.includes(name))
const ALLOWED_PLACE_NAMES = Array.from(new Set([...STATION_CHIPS, ...WAYPOINT_SUGGESTIONS]))
const ALLOWED_BOUNDS = {
  south: 43.32,
  north: 43.78,
  west: 142.35,
  east: 142.65,
}

const SEARCH_ALIASES = {
  '아사히카와역': ['아사히카와', 'asahikawa', 'asahikawa station', '旭川'],
  '비에이역': ['비에이', 'biei', 'biei station', '美瑛'],
  '지요가오카역': ['지요가오카', 'chiyogaoka', 'chiyogaoka station'],
  '후라노역': ['후라노', 'furano', 'furano station', '富良野'],
  '아사히카와 공항': ['아사히카와공항', 'asahikawa airport', 'airport'],
  '청의 호수': ['청의호수', 'blue pond', 'aoiike'],
  '흰수염폭포': ['흰수염', 'shirahige', 'shirahige falls'],
  '팜 토미타': ['토미타', 'farm tomita', 'tomita'],
  '닝구르 테라스': ['닝구르', 'ningle terrace', 'ningle'],
}

const PLACE_ALIASES = {
  '팜 토미타 (계절 따라 선택)': '팜 토미타',
  '비에이역 또는 후라노역': '비에이역',
}

function normalizePlaceName(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s*\([^)]*\)\s*/g, '').trim()
}

function normalizeSearchTerm(value) {
  return normalizePlaceName(value).toLowerCase().replace(/\s+/g, '')
}

function getSearchCandidates(name) {
  const normalized = normalizePlaceName(name)
  const compact = normalizeSearchTerm(name)
  const aliases = SEARCH_ALIASES[normalized] || SEARCH_ALIASES[name] || []
  return [name, normalized, compact, ...aliases].map((item) => normalizeSearchTerm(item)).filter(Boolean)
}

function resolveCoord(name) {
  const normalized = normalizePlaceName(name)
  const alias = PLACE_ALIASES[name] || PLACE_ALIASES[normalized] || normalized
  return COORDS_DICT[alias] || null
}

function isInAllowedRegion(lat, lng) {
  return (
    lat >= ALLOWED_BOUNDS.south &&
    lat <= ALLOWED_BOUNDS.north &&
    lng >= ALLOWED_BOUNDS.west &&
    lng <= ALLOWED_BOUNDS.east
  )
}

function shouldBlockBieiPair(departureName, destinationName) {
  return normalizePlaceName(departureName) === '비에이역' && normalizePlaceName(destinationName) === '비에이역'
}

const BIEI_PAIR_ALERT_MESSAGE =
  '교통권 문제로 인해 아사히카와 지역이 출발지 또는 도착지에 포함되어야 합니다.\n비에이역에서 2 전역인 지요가오카역에서 출발 또는 도착하실 수 있습니다.'

function extractPredictionLabel(prediction) {
  return prediction?.structured_formatting?.main_text || prediction?.description || ''
}

function getInitialRoutePreset(fixedRouteProfile, departure, destination, spots) {
  if (fixedRouteProfile) {
    return {
      departure: fixedRouteProfile.departure,
      destination: fixedRouteProfile.destination,
      spots: fixedRouteProfile.spots,
    }
  }
  return { departure, destination, spots }
}

function makePlace(name) {
  return { name: name || '', coord: resolveCoord(name) }
}

function isSameCoord(a, b) {
  if (!a || !b) return false
  return Math.abs(a.lat - b.lat) <= 0.00015 && Math.abs(a.lng - b.lng) <= 0.00015
}

function buildMarkerGroups(depCoord, destCoord, spotCoords) {
  const groups = []
  const append = (coord, payload) => {
    if (!coord) return
    const existing = groups.find((group) => isSameCoord(group.position, coord))
    if (existing) {
      existing.items.push(payload)
      return
    }
    groups.push({ position: coord, items: [payload] })
  }

  append(depCoord, { type: 'departure' })
  append(destCoord, { type: 'destination' })
  spotCoords.forEach((coord, index) => append(coord, { type: 'spot', index }))
  return groups
}

function markerAppearance(items) {
  const hasDeparture = items.some((item) => item.type === 'departure')
  const hasDestination = items.some((item) => item.type === 'destination')
  const spotIndexes = items.filter((item) => item.type === 'spot').map((item) => item.index + 1)

  if (hasDeparture && hasDestination) {
    if (spotIndexes.length === 0) return { label: '출·도', color: '#0ea5e9' }
    if (spotIndexes.length === 1) return { label: `출·도·${spotIndexes[0]}`, color: '#0ea5e9' }
    return { label: `출·도·${spotIndexes[0]}+${spotIndexes.length - 1}`, color: '#0ea5e9' }
  }

  if (hasDeparture) {
    if (spotIndexes.length === 0) return { label: '출', color: '#22c55e' }
    if (spotIndexes.length === 1) return { label: `출·${spotIndexes[0]}`, color: '#22c55e' }
    return { label: `출·${spotIndexes[0]}+${spotIndexes.length - 1}`, color: '#22c55e' }
  }

  if (hasDestination) {
    if (spotIndexes.length === 0) return { label: '도', color: '#ef4444' }
    if (spotIndexes.length === 1) return { label: `도·${spotIndexes[0]}`, color: '#ef4444' }
    return { label: `도·${spotIndexes[0]}+${spotIndexes.length - 1}`, color: '#ef4444' }
  }

  if (spotIndexes.length === 1) return { label: String(spotIndexes[0]), color: '#f59e0b' }
  if (spotIndexes.length > 1) return { label: `${spotIndexes[0]}+${spotIndexes.length - 1}`, color: '#f59e0b' }
  return { label: '', color: '#f59e0b' }
}

export default function TourRouteEditor({ initialDeparture, initialDestination, initialSpots, fixedRouteProfile, spotGuideData, onRouteStateChange }) {
  const routePreset = getInitialRoutePreset(fixedRouteProfile, initialDeparture, initialDestination, initialSpots || [])

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef(null)
  const debounceRef = useRef(null)
  const requestSeqRef = useRef(0)
  const directionsRendererRef = useRef(null)

  const [departure, setDeparture] = useState(() => makePlace(routePreset.departure))
  const [destination, setDestination] = useState(() => makePlace(routePreset.destination))
  const [spots, setSpots] = useState(routePreset.spots || [])

  const [depInput, setDepInput] = useState('')
  const [destInput, setDestInput] = useState('')
  const [waypointInput, setWaypointInput] = useState('')
  const [depPredictions, setDepPredictions] = useState([])
  const [destPredictions, setDestPredictions] = useState([])
  const [waypointPredictions, setWaypointPredictions] = useState([])
  const [selectionMode, setSelectionMode] = useState(null)
  const [selectionNotice, setSelectionNotice] = useState('')
  const [customSpotCoords, setCustomSpotCoords] = useState({})

  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [directionsResult, setDirectionsResult] = useState(null)

  const depCoord = departure.coord || resolveCoord(departure.name)
  const destCoord = destination.coord || resolveCoord(destination.name)
  const spotCoords = spots.map((spot) => resolveCoord(spot) || customSpotCoords[normalizePlaceName(spot)] || null)

  const allCoords = [depCoord, ...spotCoords, destCoord].filter(Boolean)
  const center = allCoords.length > 0
    ? {
        lat: allCoords.reduce((sum, point) => sum + point.lat, 0) / allCoords.length,
        lng: allCoords.reduce((sum, point) => sum + point.lng, 0) / allCoords.length,
      }
    : CENTER_BIEI

  const markerGroups = buildMarkerGroups(depCoord, destCoord, spotCoords)
  const selectableCoords = ALLOWED_PLACE_NAMES
    .map((name) => ({ name, coord: resolveCoord(name) }))
    .filter((item) => Boolean(item.coord))

  const clearRouteOverlay = useCallback(() => {
    requestSeqRef.current += 1
    setDirectionsResult(null)
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !depCoord || !destCoord) {
      clearRouteOverlay()
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const requestSeq = ++requestSeqRef.current
    const routeSpotCoords = spots.map((spot) => resolveCoord(spot) || customSpotCoords[normalizePlaceName(spot)] || null)

    debounceRef.current = setTimeout(() => {
      const waypoints = routeSpotCoords
        .filter(Boolean)
        .map((coord) => ({ location: coord, stopover: true }))

      new window.google.maps.DirectionsService().route(
        {
          origin: depCoord,
          destination: destCoord,
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (result, status) => {
          if (requestSeq !== requestSeqRef.current) return
          if (status === 'OK') {
            setDirectionsResult(result)
            return
          }
          clearRouteOverlay()
        }
      )
    }, 350)

    return () => {
      requestSeqRef.current += 1
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isLoaded, depCoord, destCoord, spots, customSpotCoords, clearRouteOverlay])

  useEffect(() => {
    onRouteStateChange?.({
      departure: departure.name,
      destination: destination.name,
      spots,
    })
  }, [departure.name, destination.name, spots, onRouteStateChange])

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return

    if (!directionsResult) {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null)
        directionsRendererRef.current = null
      }
      return
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: '#EAB308', strokeWeight: 4, strokeOpacity: 0.9 },
      })
    }

    directionsRendererRef.current.setMap(mapRef.current)
    directionsRendererRef.current.setDirections(directionsResult)
  }, [isLoaded, directionsResult])

  useEffect(() => {
    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null)
        directionsRendererRef.current = null
      }
    }
  }, [])

  const fetchPredictions = useCallback((value, setPredictions, sourceNames) => {
    const query = normalizeSearchTerm(value)
    if (!query) {
      setPredictions(sourceNames.slice(0, 8).map((name) => ({ type: 'preset', name })))
      return
    }

    const fallback = sourceNames
      .map((name) => ({ name, terms: getSearchCandidates(name) }))
      .filter((entry) => entry.terms.some((term) => term.includes(query)))
      .map((entry) => ({ type: 'preset', name: entry.name }))

    if (!window.google?.maps?.places?.AutocompleteService) {
      setPredictions(fallback.slice(0, 12))
      return
    }

    new window.google.maps.places.AutocompleteService().getPlacePredictions(
      {
        input: value,
        componentRestrictions: { country: 'jp' },
      },
      (predictions, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setPredictions(fallback.slice(0, 12))
          return
        }

        const googleItems = predictions.map((prediction) => ({
          type: 'google',
          placeId: prediction.place_id,
          label: extractPredictionLabel(prediction),
          description: prediction.description || '',
        }))

        const merged = [...fallback]
        googleItems.forEach((item) => {
          if (!merged.some((existing) => normalizeSearchTerm(existing.name || existing.label) === normalizeSearchTerm(item.label))) {
            merged.push(item)
          }
        })
        setPredictions(merged.slice(0, 12))
      }
    )
  }, [])

  const selectPlaceName = useCallback((name, setPlace, setInput, setPredictions) => {
    const coord = resolveCoord(name)
    if (!coord) return

    const nextDeparture = setPlace === setDeparture ? name : departure.name
    const nextDestination = setPlace === setDestination ? name : destination.name
    if (shouldBlockBieiPair(nextDeparture, nextDestination)) {
      alert(BIEI_PAIR_ALERT_MESSAGE)
      return
    }

    setPlace({ name, coord })
    if (mapRef.current) {
      mapRef.current.panTo(coord)
      mapRef.current.setZoom(11)
    }
    setInput('')
    setPredictions([])
  }, [departure.name, destination.name, setDeparture, setDestination])

  const setDepartureSafely = useCallback((name) => {
    selectPlaceName(name, setDeparture, setDepInput, setDepPredictions)
  }, [selectPlaceName])

  const setDestinationSafely = useCallback((name) => {
    selectPlaceName(name, setDestination, setDestInput, setDestPredictions)
  }, [selectPlaceName])

  const addWaypoint = useCallback((name) => {
    const normalized = normalizePlaceName(name)
    if (!normalized) return
    setSpots((prev) => {
      if (prev.some((item) => normalizePlaceName(item) === normalized)) return prev
      return [...prev, normalized]
    })
  }, [])

  const selectWaypointName = useCallback((name, coordFromSelection = null) => {
    const coord = resolveCoord(name)
    const finalCoord = coord || coordFromSelection
    if (!finalCoord) return
    if (!isInAllowedRegion(finalCoord.lat, finalCoord.lng)) {
      alert('교통권 밖이므로 상담을 통해 예약해주세요')
      return
    }
    addWaypoint(name)
    setCustomSpotCoords((prev) => ({ ...prev, [normalizePlaceName(name)]: finalCoord }))
    if (mapRef.current) {
      mapRef.current.panTo(finalCoord)
      mapRef.current.setZoom(11)
    }
    setWaypointInput('')
    setWaypointPredictions([])
  }, [addWaypoint])

  const selectPrediction = useCallback((prediction, mode) => {
    if (!prediction) return
    if (prediction.type === 'preset') {
      if (mode === 'waypoint') {
        selectWaypointName(prediction.name)
        return
      }
      if (mode === 'departure') {
        selectPlaceName(prediction.name, setDeparture, setDepInput, setDepPredictions)
        return
      }
      if (mode === 'destination') {
        selectPlaceName(prediction.name, setDestination, setDestInput, setDestPredictions)
      }
      return
    }

    if (!window.google?.maps?.places?.PlacesService || !mapRef.current) return

    new window.google.maps.places.PlacesService(mapRef.current).getDetails(
      { placeId: prediction.placeId, fields: ['name', 'geometry'] },
      (place) => {
        const name = place?.name || prediction.label
        const location = place?.geometry?.location
        if (!location) return
        const coord = { lat: location.lat(), lng: location.lng() }

        if (!isInAllowedRegion(coord.lat, coord.lng)) {
          alert('교통권 밖이므로 상담을 통해 예약해주세요')
          return
        }

        if (mode === 'waypoint') {
          selectWaypointName(name, coord)
          return
        }

        const nextDeparture = mode === 'departure' ? name : departure.name
        const nextDestination = mode === 'destination' ? name : destination.name
        if (shouldBlockBieiPair(nextDeparture, nextDestination)) {
          alert(BIEI_PAIR_ALERT_MESSAGE)
          return
        }

        const setPlace = mode === 'departure' ? setDeparture : setDestination
        const setInput = mode === 'departure' ? setDepInput : setDestInput
        const setPredictions = mode === 'departure' ? setDepPredictions : setDestPredictions
        setPlace({ name, coord })
        setInput('')
        setPredictions([])
        if (mapRef.current) {
          mapRef.current.panTo(coord)
          mapRef.current.setZoom(11)
        }
      }
    )
  }, [departure.name, destination.name, selectPlaceName, selectWaypointName])

  const applySelectionByMode = useCallback((name) => {
    if (!name) return
    if (selectionMode === 'departure') {
      selectPlaceName(name, setDeparture, setDepInput, setDepPredictions)
      setSelectionMode(null)
      setSelectionNotice('')
      return
    }
    if (selectionMode === 'destination') {
      selectPlaceName(name, setDestination, setDestInput, setDestPredictions)
      setSelectionMode(null)
      setSelectionNotice('')
      return
    }
    if (selectionMode === 'waypoint') {
      selectWaypointName(name)
      setSelectionMode(null)
      setSelectionNotice('')
    }
  }, [selectionMode, selectPlaceName, selectWaypointName])

  const handleMapClick = useCallback((event) => {
    if (!selectionMode) return
    const lat = event?.latLng?.lat?.()
    const lng = event?.latLng?.lng?.()
    if (typeof lat !== 'number' || typeof lng !== 'number') return

    let nearest = null
    let nearestDistance = Number.POSITIVE_INFINITY

    selectableCoords.forEach((item) => {
      const dx = item.coord.lat - lat
      const dy = item.coord.lng - lng
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = item
      }
    })

    if (!nearest || nearestDistance > 0.04) {
      setSelectionNotice('가까운 선택 가능 지점을 클릭해 주세요. (아사히카와·비에이·후라노 한정)')
      alert('교통권 밖이므로 상담을 통해 예약해주세요')
      return
    }

    applySelectionByMode(nearest.name)
  }, [selectionMode, selectableCoords, applySelectionByMode])

  const removeSpot = useCallback((index) => {
    setSpots((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDragStart = (index) => setDraggedIndex(index)
  const handleDragOver = (event, index) => {
    event.preventDefault()
    setDragOverIndex(index)
  }
  const handleDrop = (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...spots]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(dropIndex, 0, moved)
    setSpots(next)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }
  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const isDirty = departure.name !== routePreset.departure || destination.name !== routePreset.destination || spots.join(',') !== (routePreset.spots || []).join(',')

  const handleReset = () => {
    setDeparture(makePlace(routePreset.departure))
    setDestination(makePlace(routePreset.destination))
    setSpots(routePreset.spots || [])
    setDepInput('')
    setDestInput('')
    setWaypointInput('')
    setDepPredictions([])
    setDestPredictions([])
    setWaypointPredictions([])
    setCustomSpotCoords({})
    setSelectionMode(null)
    setSelectionNotice('')
    clearRouteOverlay()
  }

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">투어 루트</h2>
        {isDirty && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">출발지</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={depInput}
                placeholder={departure.name || '출발지 검색'}
                onFocus={() => fetchPredictions(depInput, setDepPredictions, STATION_CHIPS)}
                onChange={(e) => {
                  const value = e.target.value
                  setDepInput(value)
                  fetchPredictions(value, setDepPredictions, STATION_CHIPS)
                }}
                className="w-full pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              {depPredictions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-lg shadow-lg">
                  {depPredictions.map((prediction) => (
                    <button
                      key={`dep-pred-${prediction.placeId || prediction.name || prediction.label}`}
                      onMouseDown={() => selectPrediction(prediction, 'departure')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 border-b last:border-b-0"
                    >
                      <p className="font-medium text-gray-800 truncate">{prediction.name || prediction.label}</p>
                      {prediction.description && <p className="text-xs text-gray-400 truncate">{prediction.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATION_CHIPS.map((chip) => (
                <button
                  key={`dep-${chip}`}
                  onClick={() => setDepartureSafely(chip)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    normalizePlaceName(departure.name) === normalizePlaceName(chip)
                      ? 'bg-yellow-500 border-yellow-500 text-white font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-yellow-400'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectionMode('departure')}
              className={`w-full rounded-md border px-3 py-2 text-xs font-medium ${selectionMode === 'departure' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-yellow-400'}`}
            >
              지도에서 출발지 선택
            </button>
          </div>

          <div className="rounded-xl border bg-white p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">도착지</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={destInput}
                placeholder={destination.name || '도착지 검색'}
                onFocus={() => fetchPredictions(destInput, setDestPredictions, STATION_CHIPS)}
                onChange={(e) => {
                  const value = e.target.value
                  setDestInput(value)
                  fetchPredictions(value, setDestPredictions, STATION_CHIPS)
                }}
                className="w-full pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              {destPredictions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-lg shadow-lg">
                  {destPredictions.map((prediction) => (
                    <button
                      key={`dest-pred-${prediction.placeId || prediction.name || prediction.label}`}
                      onMouseDown={() => selectPrediction(prediction, 'destination')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 border-b last:border-b-0"
                    >
                      <p className="font-medium text-gray-800 truncate">{prediction.name || prediction.label}</p>
                      {prediction.description && <p className="text-xs text-gray-400 truncate">{prediction.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATION_CHIPS.map((chip) => (
                <button
                  key={`dest-${chip}`}
                  onClick={() => setDestinationSafely(chip)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    normalizePlaceName(destination.name) === normalizePlaceName(chip)
                      ? 'bg-yellow-500 border-yellow-500 text-white font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-yellow-400'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectionMode('destination')}
              className={`w-full rounded-md border px-3 py-2 text-xs font-medium ${selectionMode === 'destination' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-yellow-400'}`}
            >
              지도에서 도착지 선택
            </button>
          </div>

          <div className="rounded-xl border bg-white p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">경유지 추가</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={waypointInput}
                placeholder="추가할 장소 검색"
                onFocus={() => fetchPredictions(waypointInput, setWaypointPredictions, WAYPOINT_SUGGESTIONS)}
                onChange={(e) => {
                  const value = e.target.value
                  setWaypointInput(value)
                  fetchPredictions(value, setWaypointPredictions, WAYPOINT_SUGGESTIONS)
                }}
                className="w-full pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              {waypointPredictions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto bg-white border rounded-lg shadow-lg">
                  {waypointPredictions.map((prediction) => (
                    <button
                      key={`waypoint-pred-${prediction.placeId || prediction.name || prediction.label}`}
                      onMouseDown={() => selectPrediction(prediction, 'waypoint')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 border-b last:border-b-0"
                    >
                      <p className="font-medium text-gray-800 truncate">{prediction.name || prediction.label}</p>
                      {prediction.description && <p className="text-xs text-gray-400 truncate">{prediction.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {WAYPOINT_SUGGESTIONS.map((spot) => (
                <button
                  key={`waypoint-${spot}`}
                  onClick={() => addWaypoint(spot)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    spots.some((item) => normalizePlaceName(item) === normalizePlaceName(spot))
                      ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                      : 'border-gray-200 text-gray-600 hover:border-yellow-400'
                  }`}
                >
                  {spot}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectionMode('waypoint')}
              className={`w-full rounded-md border px-3 py-2 text-xs font-medium ${selectionMode === 'waypoint' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-yellow-400'}`}
            >
              지도에서 경유지 추가
            </button>
          </div>
        </div>

        <div className="h-[520px] lg:h-[680px] rounded-xl overflow-hidden border bg-gray-100">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={10}
              onLoad={(map) => { mapRef.current = map }}
              onClick={handleMapClick}
              options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            >
              {selectionMode && selectableCoords.map((item) => (
                <Marker
                  key={`candidate-${item.name}`}
                  position={item.coord}
                  onClick={() => applySelectionByMode(item.name)}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE,
                    scale: 6,
                    fillColor: '#2563eb',
                    fillOpacity: 0.9,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                />
              ))}
              {markerGroups.map((group, index) => {
                const appearance = markerAppearance(group.items)
                return (
                  <MarkerWithLabel
                    key={`group-${index}`}
                    position={group.position}
                    label={appearance.label}
                    color={appearance.color}
                    isHovered={false}
                  />
                )
              })}
            </GoogleMap>
          ) : (
            <div className="h-full flex items-center justify-center animate-pulse">
              <p className="text-sm text-gray-400">지도 로딩 중...</p>
            </div>
          )}
        </div>
      </div>

      {(selectionMode || selectionNotice) && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {selectionNotice || `지도의 파란 점(아사히카와·비에이·후라노 권역)에서 ${selectionMode === 'departure' ? '출발지' : selectionMode === 'destination' ? '도착지' : '경유지'}를 선택하세요.`}
        </div>
      )}

      {spots.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">경유지 순서</p>
          <div className="space-y-2">
            {spots.map((spot, index) => {
              const guide = spotGuideData?.[spot]
              return (
                <div
                  key={`${spot}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(event) => handleDragOver(event, index)}
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
                  <button onClick={() => removeSpot(index)} className="text-gray-400 hover:text-gray-600 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
