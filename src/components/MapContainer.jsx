'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  useLoadScript,
} from "@react-google-maps/api";
import toast from 'react-hot-toast';
import MarkerWithLabel from './MarkerWithLabel';
import RouteRenderer from './RouteRenderer';
import { COORDS_DICT } from '@/lib/spotCoords.js';
import {
  MAPS_LIBRARIES,
  isInAllowedRegion,
  normalizePlaceName,
  STATION_CHIPS,
  OUT_OF_REGION_MESSAGE,
} from '@/lib/placeUtils.js';
import { fetchPlacePredictions, resolvePrediction } from '@/lib/placesSearch.js';

// 기존 import 경로 호환을 위해 재수출한다.
export { COORDS_DICT };


// 아사히카와-비에이 지역 중심점
const centerAsahikawa = { lat: 43.7709, lng: 142.3650 };


const MapContainer = ({
  departure,
  destination,
  departureCoordinate,
  destinationCoordinate,
  spots = [],
  availableSpots = [],
  spotMeta = {},
  onPlaceChange,
  onSpotAdd,
  onSpotRemove,
  hoveredSpot,
  selectionModeRequest,
  controlsEnabled = true,
  customSpotCoords = {},
}) => {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const mapRef = useRef();
  const [selectionMode, setSelectionMode] = useState(null); // 'departure', 'destination', 'spot'
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCandidateSpot, setActiveCandidateSpot] = useState(null);
  const [placeSearchInput, setPlaceSearchInput] = useState('');
  const [placePredictions, setPlacePredictions] = useState([]);
  const handleRouteChange = useCallback(() => {}, []);

  useEffect(() => {
    if (!controlsEnabled) {
      setSelectionMode(null)
      setActiveCandidateSpot(null)
      setPlaceSearchInput('')
      setPlacePredictions([])
      return
    }
    if (!selectionModeRequest?.mode) return;
    setSelectionMode(selectionModeRequest.mode);
    if (selectionModeRequest.mode !== 'spot') {
      setActiveCandidateSpot(null);
    }
  }, [selectionModeRequest, controlsEnabled]);

  useEffect(() => {
    if (selectionMode !== 'departure' && selectionMode !== 'destination') {
      setPlaceSearchInput('');
      setPlacePredictions([]);
    }
  }, [selectionMode]);

  const selectableSpotNames = useMemo(
    () =>
      availableSpots.length > 0
        ? availableSpots.filter((spot) => !!COORDS_DICT[spot])
        : Object.keys(COORDS_DICT).filter((name) => !STATION_CHIPS.includes(name)),
    [availableSpots]
  );

  // 검색 폴백에 쓸 사전 등록 장소(역 + 관광지).
  // 렌더마다 새 배열이 되면 아래 useCallback 이 무의미해지므로 메모한다.
  const searchPresetNames = useMemo(
    () => [...STATION_CHIPS, ...selectableSpotNames],
    [selectableSpotNames]
  );

  const handlePlaceSearchChange = useCallback((value) => {
    setPlaceSearchInput(value);

    if (!value || !value.trim()) {
      setPlacePredictions([]);
      return;
    }

    // 구글 결과 + 사전 등록 장소 폴백(공용 모듈). 구글이 못 찾는
    // 한국어 지명도 사전에서 잡힌다.
    fetchPlacePredictions(value, searchPresetNames, setPlacePredictions);
  }, [searchPresetNames]);

  const handlePredictionSelect = useCallback(
    (prediction) => {
      if (!selectionMode || !['departure', 'destination'].includes(selectionMode)) return;

      resolvePrediction(prediction, mapRef.current).then((resolved) => {
        if (!resolved) return;
        const { name, coord } = resolved;

        // 교통권 밖 지점은 배차가 불가능하다.
        if (coord && !isInAllowedRegion(coord.lat, coord.lng)) {
          toast.error(OUT_OF_REGION_MESSAGE);
          return;
        }

        onPlaceChange(selectionMode, name, coord);

        if (coord && mapRef.current) {
          mapRef.current.panTo(coord);
          mapRef.current.setZoom(12);
        }

        setSelectionMode(null);
        setPlacePredictions([]);
        setPlaceSearchInput('');
        toast.success(`${name} 선택 완료`);
      });
    },
    [selectionMode, onPlaceChange]
  );

  // 출발/도착 마커를 끌어다 놓았을 때: 교통권을 확인하고 새 좌표의 지명을 찾아 반영한다.
  const handleMarkerDragEnd = useCallback(
    (mode, event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      if (!isInAllowedRegion(lat, lng)) {
        toast.error(OUT_OF_REGION_MESSAGE);
        // 원위치로 되돌리기 위해 현재 값을 다시 적용한다.
        onPlaceChange(mode, mode === 'departure' ? departure : destination,
          mode === 'departure' ? departureCoordinate : destinationCoordinate);
        return;
      }

      const coord = { lat, lng };
      const applyName = (name) => {
        onPlaceChange(mode, name, coord);
        toast.success(`${mode === 'departure' ? '출발지' : '도착지'}를 ${name}(으)로 옮겼습니다`);
      };

      // 좌표만 남기지 않고 지명을 붙여 준다. 실패하면 좌표 표기로 대체한다.
      if (!window.google?.maps?.Geocoder) {
        applyName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }

      new window.google.maps.Geocoder().geocode({ location: coord, language: 'ko' }, (results, status) => {
        if (status !== 'OK' || !results?.length) {
          applyName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          return;
        }
        // 가장 구체적인 결과의 지명을 쓴다.
        const best = results[0];
        const poi = best.address_components?.find((c) => c.types?.includes('point_of_interest'));
        applyName(poi?.long_name || best.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      });
    },
    [departure, destination, departureCoordinate, destinationCoordinate, onPlaceChange]
  );

  // 확장 상태에서 ESC 로 닫기. 열려 있는 동안 배경 스크롤을 막는다.
  useEffect(() => {
    if (!isExpanded) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  // 지도 클릭 핸들러
  const handleMapClick = useCallback((event) => {
    if (!controlsEnabled) return;
    if (activeCandidateSpot) {
      setActiveCandidateSpot(null);
    }

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    if (!isInAllowedRegion(lat, lng)) {
      toast.error("비에이·아사히카와 지역만 선택 가능합니다");
      return;
    }

    if (selectionMode) {
      if (selectionMode === 'departure') {
        onPlaceChange('departure', `${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
      } else if (selectionMode === 'destination') {
        onPlaceChange('destination', `${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
      } else if (selectionMode === 'spot') {
        toast('관광지 추가 모드에서는 파란 마커를 눌러 선택해 주세요');
        return;
      }
      
      setSelectionMode(null);
      toast.success("위치가 선택되었습니다");
    }
  }, [activeCandidateSpot, selectionMode, isInAllowedRegion, onPlaceChange, controlsEnabled]);

  // 마커 생성
  const renderMarkers = useCallback(() => {
    const markers = [];

    // 출발지 마커
    if (departure) {
      const normalizedDeparture = normalizePlaceName(departure)
      const coords = departureCoordinate || COORDS_DICT[normalizedDeparture] || 
        (departure.includes(',') ? {
          lat: parseFloat(departure.split(',')[0]),
          lng: parseFloat(departure.split(',')[1])
        } : null);
      
      if (coords) {
        markers.push(
          <MarkerWithLabel
            key="departure"
            position={coords}
            label="출발"
            color="#22c55e"
            isHovered={false}
            draggable={controlsEnabled}
            onDragEnd={(event) => handleMarkerDragEnd('departure', event)}
            title={controlsEnabled ? '끌어서 출발지를 옮길 수 있습니다' : undefined}
          />
        );
      }
    }

    // 도착지 마커
    if (destination) {
      const normalizedDestination = normalizePlaceName(destination)
      const coords = destinationCoordinate || COORDS_DICT[normalizedDestination] || 
        (destination.includes(',') ? {
          lat: parseFloat(destination.split(',')[0]),
          lng: parseFloat(destination.split(',')[1])
        } : null);
      
      if (coords) {
        markers.push(
          <MarkerWithLabel
            key="destination"
            position={coords}
            label="도착"
            color="#ef4444"
            isHovered={false}
            draggable={controlsEnabled}
            onDragEnd={(event) => handleMarkerDragEnd('destination', event)}
            title={controlsEnabled ? '끌어서 도착지를 옮길 수 있습니다' : undefined}
          />
        );
      }
    }

    // 관광지 마커들
    spots.forEach((spot, index) => {
      const normalizedSpot = normalizePlaceName(spot)
      const coords = customSpotCoords[normalizedSpot] || COORDS_DICT[normalizedSpot] || 
        (spot.includes(',') ? {
          lat: parseFloat(spot.split(',')[0]),
          lng: parseFloat(spot.split(',')[1])
        } : null);
      
      if (coords) {
        markers.push(
          <MarkerWithLabel
            key={`spot-${spot}-${index}`}
            position={coords}
            label={`${index + 1}`}
            color="#f59e0b"
            isHovered={hoveredSpot === spot}
            onClick={() => onSpotRemove && onSpotRemove(spot)}
          />
        );
      }
    });

    return markers;
  }, [departure, destination, departureCoordinate, destinationCoordinate, spots, hoveredSpot, onSpotRemove, customSpotCoords]);

  const handleSelectableSpotClick = useCallback(
    (spotName) => {
      setActiveCandidateSpot(spotName);
    },
    []
  );

  const handleCandidateSpotAdd = useCallback(
    (spotName) => {
      if (spots.includes(spotName)) {
        toast('이미 추가된 관광지입니다');
        return;
      }

      onSpotAdd(spotName);
      setActiveCandidateSpot(null);
      toast.success(`${spotName}이(가) 추가되었습니다`);
    },
    [spots, onSpotAdd]
  );

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
          <p>지도 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-[60] bg-white'
          : 'h-full w-full relative'
      }
    >
      {/* 크게 보기 토글 */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="absolute bottom-3 right-3 z-20 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-md hover:bg-gray-50"
      >
        {isExpanded ? '작게 보기 (ESC)' : '크게 보기'}
      </button>

      {/* 상단 컨트롤 패널 */}
      {controlsEnabled && <div className="absolute top-2 left-2 right-2 z-10 bg-white rounded-lg shadow-md p-3">
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => {
              setSelectionMode('departure')
              setActiveCandidateSpot(null)
            }}
            className={`px-3 py-1 rounded text-sm font-medium ${
              selectionMode === 'departure'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            출발지 선택
          </button>
          <button
            onClick={() => {
              setSelectionMode('destination')
              setActiveCandidateSpot(null)
            }}
            className={`px-3 py-1 rounded text-sm font-medium ${
              selectionMode === 'destination'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            도착지 선택
          </button>
          <button
            onClick={() => setSelectionMode('spot')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              selectionMode === 'spot'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            + 장소 추가
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          지도의 출발/도착 마커를 끌어서 위치를 옮길 수 있습니다.
        </p>

        {(selectionMode === 'departure' || selectionMode === 'destination') && (
          <div className="mb-2">
            <input
              type="text"
              value={placeSearchInput}
              onChange={(e) => handlePlaceSearchChange(e.target.value)}
              placeholder={`구글 지도에서 ${selectionMode === 'departure' ? '출발지' : '도착지'} 검색`}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
            />

            {placePredictions.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-white shadow-sm">
                {placePredictions.map((prediction, index) => (
                  <button
                    key={prediction.type === 'preset' ? `preset-${prediction.name}` : `google-${prediction.placeId || index}`}
                    type="button"
                    onClick={() => handlePredictionSelect(prediction)}
                    className="w-full border-b px-3 py-2 text-left text-sm hover:bg-yellow-50 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">
                      {prediction.type === 'preset' ? prediction.name : prediction.label}
                    </p>
                    {prediction.type === 'google' && prediction.description && (
                      <p className="text-xs text-gray-500">{prediction.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectionMode && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            {selectionMode === 'spot'
              ? '파란 마커를 클릭해 관광지를 추가하세요'
              : `지도를 클릭하여 ${selectionMode === 'departure' ? '출발지' : '도착지'}를 선택하세요`}
          </div>
        )}
      </div>}

      {/* 지도 */}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={centerAsahikawa}
        zoom={10}
        onLoad={(map) => (mapRef.current = map)}
        onClick={handleMapClick}
        options={{
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: !isExpanded ? false : true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {/* 마커들 */}
        {renderMarkers()}

        {controlsEnabled && selectionMode === 'spot' &&
          selectableSpotNames.map((spotName) => {
            const coords = COORDS_DICT[spotName];
            const isSelected = spots.includes(spotName);

            return (
              <Marker
                key={`candidate-${spotName}`}
                position={coords}
                title={spotName}
                onClick={() => handleSelectableSpotClick(spotName)}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE,
                  scale: isSelected ? 7 : 6,
                  fillColor: isSelected ? '#22c55e' : '#3b82f6',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
                label={{
                  text: spotName,
                  color: '#1f2937',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              />
            );
          })}
        
        {/* 경로 렌더링 */}
        <RouteRenderer
          key={`${departure || ''}|${destination || ''}|${spots.join('>')}`}
          departure={departure}
          destination={destination}
          departureCoordinate={departureCoordinate}
          destinationCoordinate={destinationCoordinate}
          spots={spots}
          customSpotCoords={customSpotCoords}
          onRouteChange={handleRouteChange}
        />
      </GoogleMap>

      {controlsEnabled && selectionMode === 'spot' && activeCandidateSpot && (
        <div className="absolute bottom-3 left-3 right-3 z-20 md:left-auto md:max-w-sm">
          <div className="rounded-xl border bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeCandidateSpot}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {spotMeta[activeCandidateSpot]?.isPopular && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      인기 장소
                    </span>
                  )}
                  {spots.includes(activeCandidateSpot) && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                      이미 선택됨
                    </span>
                  )}
                </div>
              </div>
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                onClick={() => setActiveCandidateSpot(null)}
              >
                닫기
              </button>
            </div>

            {spotMeta[activeCandidateSpot]?.includedCourses?.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-gray-600">
                추천 코스: {spotMeta[activeCandidateSpot].includedCourses.slice(0, 2).join(', ')}
                {spotMeta[activeCandidateSpot].includedCourses.length > 2 ? ' 외' : ''}
              </p>
            )}

            {spotMeta[activeCandidateSpot]?.guide?.stayMinutes && (
              <p className="mt-2 text-xs text-gray-700">
                추천 체류시간: <span className="font-semibold">약 {spotMeta[activeCandidateSpot].guide.stayMinutes}분</span>
              </p>
            )}

            {spotMeta[activeCandidateSpot]?.guide?.photoPoint && (
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                사진 포인트: {spotMeta[activeCandidateSpot].guide.photoPoint}
              </p>
            )}

            {spotMeta[activeCandidateSpot]?.guide?.nearby?.length > 0 && (
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                근처 추천: {spotMeta[activeCandidateSpot].guide.nearby.slice(0, 2).join(', ')}
              </p>
            )}

            <button
              className="mt-3 w-full rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              onClick={() => handleCandidateSpotAdd(activeCandidateSpot)}
              disabled={spots.includes(activeCandidateSpot)}
            >
              {spots.includes(activeCandidateSpot) ? '이미 추가됨' : '이 장소 추가'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer; 
