import { useCallback, useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useLoadScript,
  Autocomplete,
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
  "후라노역": { lat: 43.3471, lng: 142.3917 },
};

const MapContainer = ({
  departure,
  destination,
  spots = [],
  onPlaceChange,
  onSpotAdd,
  onSpotRemove,
  hoveredSpot,
}) => {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: ["places"],
  });

  const mapRef = useRef();
  const [selectionMode, setSelectionMode] = useState(null); // 'departure', 'destination', 'spot'

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
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    if (!isInAllowedRegion(lat, lng)) {
      toast.error("비에이·아사히카와 지역만 선택 가능합니다");
      return;
    }

    if (selectionMode) {
      if (selectionMode === 'departure') {
        onPlaceChange('departure', `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } else if (selectionMode === 'destination') {
        onPlaceChange('destination', `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } else if (selectionMode === 'spot') {
        onSpotAdd(`위치 ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
      
      setSelectionMode(null);
      toast.success("위치가 선택되었습니다");
    }
  }, [selectionMode, isInAllowedRegion, onPlaceChange, onSpotAdd]);

  // 마커 생성
  const renderMarkers = useCallback(() => {
    const markers = [];

    // 출발지 마커
    if (departure) {
      const coords = COORDS_DICT[departure] || 
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
      const coords = COORDS_DICT[destination] || 
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
  }, [departure, destination, spots, hoveredSpot, onSpotRemove]);

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
            onClick={() => setSelectionMode('departure')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              selectionMode === 'departure'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            출발지 선택
          </button>
          <button
            onClick={() => setSelectionMode('destination')}
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
        
        {selectionMode && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            지도를 클릭하여 {selectionMode === 'departure' ? '출발지' : selectionMode === 'destination' ? '도착지' : '관광지'}를 선택하세요
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
        
        {/* 경로 렌더링 */}
        <RouteRenderer
          departure={departure}
          destination={destination}
          spots={spots}
          onRouteChange={() => {}} // 빈 함수로 처리
        />
      </GoogleMap>
    </div>
  );
};

export default MapContainer; 