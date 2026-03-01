import { useEffect, useRef, useCallback, useState } from 'react';
import { DirectionsRenderer } from '@react-google-maps/api';
import { COORDS_DICT } from './MapContainer';

const RouteRenderer = ({
  departure,
  destination,
  departureCoordinate,
  destinationCoordinate,
  spots = [],
  onRouteChange,
}) => {
  const directionsService = useRef(null);
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
    
    // 좌표 사전에서 찾기
    if (COORDS_DICT[location]) {
      return COORDS_DICT[location];
    }
    
    // 직접 입력된 좌표인지 확인
    if (location.includes(',')) {
      const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    
    return null;
  }, []);

  // 경로 계산 (디바운싱 적용)
  const calculateRoute = useCallback(() => {
    if (!directionsService.current || !departure || !destination) {
      setDirectionsResult(null);
      return;
    }

    const departureCoords = departureCoordinate || getCoordinates(departure);
    const destinationCoords = destinationCoordinate || getCoordinates(destination);

    if (!departureCoords || !destinationCoords) {
      setDirectionsResult(null);
      return;
    }

    // 경유지 처리
    const waypoints = spots
      .map(spot => getCoordinates(spot))
      .filter(coords => coords !== null)
      .map(coords => ({
        location: coords,
        stopover: true,
      }));

    // 디바운싱 처리
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      directionsService.current.route(
        {
          origin: departureCoords,
          destination: destinationCoords,
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
        },
        (result, status) => {
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
