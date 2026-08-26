import { useState } from 'react';
import { Marker } from '@react-google-maps/api';

const MarkerWithLabel = ({
  position,
  label,
  color = "#f59e0b",
  isHovered = false,
  onClick,
  draggable = false,
  onDragEnd,
  title,
}) => {
  const [isVisible] = useState(true);

  const createMarkerIcon = (markerColor, hovered) => ({
    path: window.google?.maps?.SymbolPath?.CIRCLE,
    scale: hovered ? 13 : 11,
    fillColor: markerColor,
    fillOpacity: 1,
    strokeColor: '#111827',
    strokeWeight: hovered ? 3 : 2,
  });

  return isVisible ? (
    <Marker
      position={position}
      icon={createMarkerIcon(color, isHovered)}
      onClick={onClick}
      draggable={draggable}
      onDragEnd={onDragEnd}
      title={title}
      cursor={draggable ? 'grab' : undefined}
      animation={isHovered ? window.google?.maps?.Animation?.BOUNCE : null}
      label={{
        text: label,
        color: 'white',
        fontSize: isHovered ? '15px' : '14px',
        fontWeight: '800',
        className: 'marker-label'
      }}
    />
  ) : null;
};

export default MarkerWithLabel; 
