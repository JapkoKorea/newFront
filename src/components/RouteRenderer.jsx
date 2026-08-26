import { useEffect, useRef, useCallback, useState } from 'react';
import { DirectionsRenderer } from '@react-google-maps/api';
import { COORDS_DICT } from '@/lib/spotCoords.js';

const normalizeLocationKey = (location) => {
  if (typeof location !== 'string') return '';
  return location.replace(/\s*\([^)]*\)\s*/g, '').trim();
};

const RouteRenderer = ({
  departure,
  destination,
  departureCoordinate,
  destinationCoordinate,
  spots = [],
  customSpotCoords = {},
  onRouteChange,
}) => {
  const directionsService = useRef(null);
  const requestSequenceRef = useRef(0);
  const [directionsResult, setDirectionsResult] = useState(null);
  const debounceTimeoutRef = useRef(null);

  // DirectionsService 초기화
  useEffect(() => {
    if (window.google && window.google.maps && !directionsService.current) {
      directionsService.current = new window.google.maps.DirectionsService();
    }
  }, []);

  // 좌표 변환 유틸리티
  const getCoordinates = useCallback((location) => {
    if (!location) return null;
    const normalizedLocation = normalizeLocationKey(location);
    
    if (customSpotCoords[normalizedLocation]) {
      return customSpotCoords[normalizedLocation];
    }

    // 좌표 사전에서 찾기
    if (COORDS_DICT[normalizedLocation]) {
      return COORDS_DICT[normalizedLocation];
    }
    
    // 직접 입력된 좌표인지 확인
    if (normalizedLocation.includes(',')) {
      const [lat, lng] = normalizedLocation.split(',').map(coord => parseFloat(coord.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    
    return null;
  }, [customSpotCoords]);

  // 경로 계산 (디바운싱 적용)
  const calculateRoute = useCallback(() => {
    const bail = () => {
      requestSequenceRef.current += 1;
      setDirectionsResult(null);
      onRouteChange?.(null);
    };

    if (!directionsService.current || !departure) {
      bail();
      return;
    }

    const departureCoords = departureCoordinate || getCoordinates(departure);
    if (!departureCoords) {
      bail();
      return;
    }

    const spotCoords = spots
      .map((spot) => getCoordinates(spot))
      .filter((coords) => coords !== null);

    // 도착지가 아직 정해지지 않았어도 선택한 코스가 있으면 순서대로 경로를 그린다.
    // 마지막 코스를 임시 도착점으로 삼는다. 도착지를 정하면 그 지점으로 대체된다.
    let destinationCoords = destination
      ? destinationCoordinate || getCoordinates(destination)
      : null;
    let waypointCoords = spotCoords;

    if (!destinationCoords) {
      if (spotCoords.length === 0) {
        bail();
        return;
      }
      destinationCoords = spotCoords[spotCoords.length - 1];
      waypointCoords = spotCoords.slice(0, -1);
    }

    // 경유지 처리
    const waypoints = waypointCoords.map((coords) => ({
      location: coords,
      stopover: true,
    }));

    // 디바운싱 처리
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const requestSeq = ++requestSequenceRef.current;

    debounceTimeoutRef.current = setTimeout(() => {
      directionsService.current.route(
        {
          origin: departureCoords,
          destination: destinationCoords,
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (result, status) => {
          if (requestSeq !== requestSequenceRef.current) {
            return;
          }
          if (status === 'OK') {
            setDirectionsResult(result);
            onRouteChange?.(result);
          } else {
            console.error('Directions request failed:', status);
            setDirectionsResult(null);
            onRouteChange?.(null);
          }
        }
      );
    }, 300); // 300ms 디바운싱
  }, [departure, destination, departureCoordinate, destinationCoordinate, spots, getCoordinates, onRouteChange]);

  // 경로 재계산
  useEffect(() => {
    calculateRoute();
    
    return () => {
      requestSequenceRef.current += 1;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [calculateRoute]);

  return directionsResult ? (
    <DirectionsRenderer
      directions={directionsResult}
      options={{
        suppressMarkers: true, // 기본 마커 숨김 (커스텀 마커 사용)
        preserveViewport: true,
        polylineOptions: {
          strokeColor: '#f59e0b',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      }}
    />
  ) : null;
};

export default RouteRenderer; 
