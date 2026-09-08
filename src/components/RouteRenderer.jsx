import { useEffect, useRef, useCallback, useState } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { COORDS_DICT } from '@/lib/spotCoords.js';
import { clearRoute, computeRoute, drawRoute } from '@/lib/routePath.js';

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
  const map = useGoogleMap();
  const requestSequenceRef = useRef(0);
  const polylinesRef = useRef([]);
  const debounceTimeoutRef = useRef(null);
  const [, setRoute] = useState(null);

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
      clearRoute(polylinesRef.current);
      polylinesRef.current = [];
      setRoute(null);
      onRouteChange?.(null);
    };

    if (!map || !departure) {
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

    // 디바운싱 처리
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const requestSeq = ++requestSequenceRef.current;

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const route = await computeRoute(departureCoords, destinationCoords, waypointCoords);
        // 요청이 도는 사이에 경로가 또 바뀌었으면 이 결과는 버린다.
        if (requestSeq !== requestSequenceRef.current) return;

        clearRoute(polylinesRef.current);
        polylinesRef.current = route ? drawRoute(route, map) : [];
        setRoute(route);
        onRouteChange?.(route);
      } catch (error) {
        if (requestSeq !== requestSequenceRef.current) return;
        console.error('경로 계산 실패:', error);
        clearRoute(polylinesRef.current);
        polylinesRef.current = [];
        setRoute(null);
        onRouteChange?.(null);
      }
    }, 300); // 300ms 디바운싱
  }, [map, departure, destination, departureCoordinate, destinationCoordinate, spots, getCoordinates, onRouteChange]);

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

  // 화면을 떠날 때 그려 둔 선을 지운다.
  useEffect(() => () => {
    clearRoute(polylinesRef.current);
    polylinesRef.current = [];
  }, []);

  // 선은 지도 객체에 직접 붙이므로 그릴 것이 없다.
  return null;
};

export default RouteRenderer;
