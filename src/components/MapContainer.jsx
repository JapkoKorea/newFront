'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  useLoadScript,
} from "@react-google-maps/api";
import toast from 'react-hot-toast';
import MarkerWithLabel from './MarkerWithLabel';
import RouteRenderer from './RouteRenderer';

// 아사히카와-비에이 지역 중심점
const centerAsahikawa = { lat: 43.7709, lng: 142.3650 };

// 허용 지역 폴리곤 (아사히카와-비에이 행정구역)
const allowedRegionBounds = {
  north: 43.85,
  south: 43.35,
  west: 142.2,
  east: 142.7,
};
43.34708565187582, 142.39165800924965
// 관광지 좌표 사전
export const COORDS_DICT = {
  "크리스마스 나무": { lat: 43.5546, lng: 142.4445 },
  "세븐스타 나무": { lat: 43.5902, lng: 142.4551 },
  "켄과 메리 나무": { lat: 43.6093, lng: 142.4647 },
  "마일드세븐 언덕": { lat: 43.6053, lng: 142.4102 },
  "탁신관": { lat: 43.53, lng: 142.4894 },
  "흰수염폭포": { lat: 43.4754, lng: 142.6395 },
  "청의 호수": { lat: 43.4936, lng: 142.6149 },
  "패치워크의 길": { lat: 43.6308, lng: 142.4292 },
  "닝구르 테라스": { lat: 43.3234, lng: 142.3572 },
  "팜 토미타": { lat: 43.4184, lng: 142.4287 },
  "사계채언덕 (四季彩の丘)": { lat: 43.5293, lng: 142.4659 },
  "아사히야마 동물원": { lat: 43.7690, lng: 142.4801 },
  "아사히카와역": { lat: 43.7629, lng: 142.3593 },
  "비에이역": { lat: 43.5913, lng: 142.4622 },
  "지요가오카역": { lat: 43.5695, lng: 142.4886 },
  "후라노역": { lat: 43.3471, lng: 142.3917 },
};

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
}) => {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
    libraries: ["places"],
  });

  const mapRef = useRef();
  const [selectionMode, setSelectionMode] = useState(null); // 'departure', 'destination', 'spot'
  const [activeCandidateSpot, setActiveCandidateSpot] = useState(null);
  const [placeSearchInput, setPlaceSearchInput] = useState('');
  const [placePredictions, setPlacePredictions] = useState([]);

  useEffect(() => {
    if (!selectionModeRequest?.mode) return;
    setSelectionMode(selectionModeRequest.mode);
    if (selectionModeRequest.mode !== 'spot') {
      setActiveCandidateSpot(null);
    }
  }, [selectionModeRequest]);

  useEffect(() => {
    if (selectionMode !== 'departure' && selectionMode !== 'destination') {
      setPlaceSearchInput('');
      setPlacePredictions([]);
    }
  }, [selectionMode]);

  const handlePlaceSearchChange = useCallback((value) => {
    setPlaceSearchInput(value);

    if (!value || value.trim().length < 2 || !window.google?.maps?.places?.AutocompleteService) {
      setPlacePredictions([]);
      return;
    }

    const autocompleteService = new window.google.maps.places.AutocompleteService();
    autocompleteService.getPlacePredictions(
      {
        input: value,
        componentRestrictions: { country: 'jp' },
      },
      (predictions, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setPlacePredictions([]);
          return;
        }
        setPlacePredictions(predictions.slice(0, 6));
      }
    );
  }, []);

  const handlePredictionSelect = useCallback(
    (prediction) => {
      if (!selectionMode || !['departure', 'destination'].includes(selectionMode)) return;

      if (!window.google?.maps?.places?.PlacesService || !mapRef.current) {
        onPlaceChange(selectionMode, prediction.description, null);
        setSelectionMode(null);
        setPlacePredictions([]);
        setPlaceSearchInput('');
        return;
      }

      const placesService = new window.google.maps.places.PlacesService(mapRef.current);
      placesService.getDetails(
        { placeId: prediction.place_id, fields: ['name', 'geometry'] },
        (place) => {
          const placeName = place?.name || prediction.structured_formatting?.main_text || prediction.description;
          const location = place?.geometry?.location;
          const resolvedCoords = location ? { lat: location.lat(), lng: location.lng() } : null;
          onPlaceChange(selectionMode, placeName, resolvedCoords);

          if (location && mapRef.current) {
            mapRef.current.panTo(location);
            mapRef.current.setZoom(13);
          }

          setSelectionMode(null);
          setPlacePredictions([]);
          setPlaceSearchInput('');
          toast.success(`${placeName} 선택 완료`);
        }
      );
    },
    [selectionMode, onPlaceChange]
  );

  const selectableSpotNames =
    availableSpots.length > 0
      ? availableSpots.filter((spot) => !!COORDS_DICT[spot])
      : Object.keys(COORDS_DICT).filter(
          (name) => !["아사히카와역", "비에이역", "지요가오카역", "후라노역"].includes(name)
        );

  // 허용 지역 내 좌표인지 확인
  const isInAllowedRegion = useCallback((lat, lng) => {
    return (
      lat >= allowedRegionBounds.south &&
      lat <= allowedRegionBounds.north &&
      lng >= allowedRegionBounds.west &&
      lng <= allowedRegionBounds.east
    );
  }, []);

  // 지도 클릭 핸들러
  const handleMapClick = useCallback((event) => {
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
  }, [activeCandidateSpot, selectionMode, isInAllowedRegion, onPlaceChange]);

  // 마커 생성
  const renderMarkers = useCallback(() => {
    const markers = [];

    // 출발지 마커
    if (departure) {
      const coords = departureCoordinate || COORDS_DICT[departure] || 
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
          />
        );
      }
    }

    // 도착지 마커
    if (destination) {
      const coords = destinationCoordinate || COORDS_DICT[destination] || 
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
          />
        );
      }
    }

    // 관광지 마커들
    spots.forEach((spot, index) => {
      const coords = COORDS_DICT[spot] || 
        (spot.includes(',') ? {
          lat: parseFloat(spot.split(',')[0]),
          lng: parseFloat(spot.split(',')[1])
        } : null);
      
      if (coords) {
        markers.push(
          <MarkerWithLabel
            key={`spot-${index}`}
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
  }, [departure, destination, departureCoordinate, destinationCoordinate, spots, hoveredSpot, onSpotRemove]);

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
    <div className="h-full w-full relative">
      {/* 상단 컨트롤 패널 */}
      <div className="absolute top-2 left-2 right-2 z-10 bg-white rounded-lg shadow-md p-3">
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
                {placePredictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    type="button"
                    onClick={() => handlePredictionSelect(prediction)}
                    className="w-full border-b px-3 py-2 text-left text-sm hover:bg-yellow-50 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">{prediction.structured_formatting?.main_text || prediction.description}</p>
                    {prediction.structured_formatting?.secondary_text && (
                      <p className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</p>
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
      </div>

      {/* 지도 */}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={centerAsahikawa}
        zoom={11}
        onLoad={(map) => (mapRef.current = map)}
        onClick={handleMapClick}
        options={{
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

        {selectionMode === 'spot' &&
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
          departure={departure}
          destination={destination}
          departureCoordinate={departureCoordinate}
          destinationCoordinate={destinationCoordinate}
          spots={spots}
          onRouteChange={() => {}} // 빈 함수로 처리
        />
      </GoogleMap>

      {selectionMode === 'spot' && activeCandidateSpot && (
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
