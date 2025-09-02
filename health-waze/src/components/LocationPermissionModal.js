import React from 'react';
import { LocationIcon } from './Icons';
import './LocationPermissionModal.css';

const LocationPermissionModal = ({ onResponse }) => {
  const handleAllow = () => {
    onResponse(true);
  };

  const handleDeny = () => {
    onResponse(false);
  };

  return (
    <div className="location-modal-overlay">
      <div className="location-modal">
        <div className="location-modal__icon">
          <LocationIcon size={48} />
        </div>
        
        <h2 className="location-modal__title">
          Share Your Location
        </h2>
        
        <p className="location-modal__message">
          Share your location so we can recommend the centre which you will lose less time with
        </p>
        
        <div className="location-modal__reward">
          <span className="location-modal__reward-label">First time bonus:</span>
          <span className="location-modal__reward-value">+1 hour T$</span>
        </div>
        
        <div className="location-modal__actions">
          <button 
            className="location-modal__button location-modal__button--secondary"
            onClick={handleDeny}
          >
            Not Now
          </button>
          <button 
            className="location-modal__button location-modal__button--primary"
            onClick={handleAllow}
          >
            Allow Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionModal;