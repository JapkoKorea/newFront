import { useState } from 'react';
import { Marker } from '@react-google-maps/api';

const MarkerWithLabel = ({
  position,
  label,
  color = "#f59e0b",
  isHovered = false,
  onClick,
}) => {
  const [isVisible] = useState(true);

  // 마커 아이콘 생성
  const createMarkerIcon = (color, isHovered) => ({
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: isHovered ? 1.2 : 1,
    anchor: { x: 12, y: 24 },
  });

  return isVisible ? (
    <Marker
      position={position}
      icon={createMarkerIcon(color, isHovered)}
      onClick={onClick}
      animation={isHovered ? window.google?.maps?.Animation?.BOUNCE : null}
      label={{
        text: label,
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        className: 'marker-label'
      }}
    />
  ) : null;
};

export default MarkerWithLabel; 