import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import HealthCenterMarker from './HealthCenterMarker';
import UserLocationMarker from './UserLocationMarker';
import 'leaflet/dist/leaflet.css';
import './HealthMap.css';

// Fix Leaflet icon issues
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to control map center
const MapCenterController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
};

const HealthMap = ({ 
  pins = [], 
  highlights = [], 
  userLocation, 
  onPinClick,
  selectedPin
}) => {
  // Default center for Goiânia if no pins
  const defaultCenter = [-16.6514931, -49.3280203];
  
  // Calculate map center based on highlights or all pins
  const getMapCenter = () => {
    if (highlights.length === 1) {
      const highlightedPin = pins.find(p => highlights.includes(p.id));
      if (highlightedPin) {
        return [highlightedPin.lat, highlightedPin.lng];
      }
    } else if (highlights.length === 2) {
      const highlightedPins = pins.filter(p => highlights.includes(p.id));
      if (highlightedPins.length === 2) {
        const midLat = (highlightedPins[0].lat + highlightedPins[1].lat) / 2;
        const midLng = (highlightedPins[0].lng + highlightedPins[1].lng) / 2;
        return [midLat, midLng];
      }
    }
    
    // Default to user location or default center
    return userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter;
  };

  const mapCenter = getMapCenter();

  return (
    <div className="map-container">
      <MapContainer 
        center={mapCenter} 
        zoom={12} 
        className="health-map"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors & CartoDB'
        />
        
        <MapCenterController center={mapCenter} zoom={12} />
        
        {pins.map(pin => (
          <HealthCenterMarker
            key={pin.id}
            pin={pin}
            isHighlighted={highlights.includes(pin.id)}
            isSelected={selectedPin?.id === pin.id}
            onMarkerClick={() => onPinClick(pin)}
          />
        ))}
        
        {userLocation && (
          <UserLocationMarker location={userLocation} />
        )}
      </MapContainer>
    </div>
  );
};

export default HealthMap;