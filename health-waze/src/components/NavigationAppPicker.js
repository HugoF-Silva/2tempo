import React from 'react';
import PropTypes from 'prop-types';
import './NavigationAppPicker.css';
import { getGoogleMapsIntent, getWazeIntent, getUberIntent } from '../utils/navigation';

export function NavigationAppPicker({ destination, userLocation, onClose }) {
  const apps = [
    {
      key: 'google',
      label: 'Google Maps',
      logo: '/logos/google.png',
      handler: (dest, loc) => getGoogleMapsIntent(dest, loc)
    },
    {
      key: 'waze',
      label: 'Waze',
      logo: '/logos/waze.png',
      handler: (dest) => getWazeIntent(dest)
    },
    {
      key: 'uber',
      label: 'Uber',
      logo: '/logos/uber.png',
      handler: (dest) => getUberIntent(dest)
    }
  ];

  const handleAppClick = (app) => {
    const url = app.key === 'google'
      ? app.handler(destination, userLocation)
      : app.handler(destination);

    window.location.href = url;
    onClose();
  };

  return (
    <div
      className="navigation-app-picker-overlay"
      onClick={onClose}                        // ← click outside → close
    >
      <div
        className="navigation-app-picker-dialog"
        onClick={e => e.stopPropagation()}    // ← eat clicks inside
      >
        <h3 className="navigation-app-picker-header">Open with:</h3>
        <div className="navigation-app-list">
          {apps.map((app) => (
            <button
              key={app.key}
              className={`navigation-app-button ${app.key}`}
              onClick={() => handleAppClick(app)}
            >
              <img src={app.logo} alt={`${app.label} logo`} />
              <span>{app.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

NavigationAppPicker.propTypes = {
  destination: PropTypes.shape({ lat: PropTypes.number.isRequired, lng: PropTypes.number.isRequired }).isRequired,
  userLocation: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
  onClose: PropTypes.func.isRequired,
};