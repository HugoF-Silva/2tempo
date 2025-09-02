import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import './UserLocationMarker.css';

const UserLocationMarker = ({ location }) => {
  const userIcon = L.divIcon({
    html: `
      <div class="user-location-marker">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  return (
    <Marker position={[location.lat, location.lng]} icon={userIcon}>
      <Popup>
        <div className="user-popup-content">
          You are here
        </div>
      </Popup>
    </Marker>
  );
};

export default UserLocationMarker;