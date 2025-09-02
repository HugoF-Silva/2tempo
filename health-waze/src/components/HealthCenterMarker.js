import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import './HealthCenterMarker.css';

const HealthCenterMarker = ({ pin, isHighlighted, isSelected, onMarkerClick }) => {
  // Determine pin color based on status or locked state
  const getPinColor = () => {
    if (pin.locked) return '#999999'; // Grey for locked
    
    const statusColors = {
      full: '#dc2626',    // Red
      average: '#eab308', // Yellow  
      empty: '#16a34a'    // Green
    };
    
    return statusColors[pin.status] || '#999999';
  };

  const pinColor = getPinColor();

  const markerHtml = `
    <div class="health-marker ${isHighlighted ? 'health-marker--highlighted' : ''} ${isSelected ? 'health-marker--selected' : ''}">
      <div class="marker-pin">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 0C12.5 0 6 6.5 6 14C6 24.5 20 40 20 40C20 40 34 24.5 34 14C34 6.5 27.5 0 20 0Z" 
                fill="${pinColor}"/>
          <circle cx="20" cy="14" r="6" fill="white"/>
          <path d="M20 11V17M17 14H23" 
                stroke="${pinColor}" 
                stroke-width="2" 
                stroke-linecap="round"/>
        </svg>
        ${isHighlighted ? '<div class="highlight-ring"></div>' : ''}
      </div>
    </div>
  `;

  const icon = L.divIcon({
    html: markerHtml,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });

  return (
    <Marker 
      position={[pin.lat, pin.lng]} 
      icon={icon}
      eventHandlers={{
        click: onMarkerClick
      }}
    />
  );
};

export default HealthCenterMarker;