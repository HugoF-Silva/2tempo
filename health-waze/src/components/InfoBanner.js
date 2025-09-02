import React from 'react';
import './InfoBanner.css';

const InfoBanner = ({ children }) => {
  return (
    <div className="info-banner">
      <p>{children}</p>
    </div>
  );
};

export default InfoBanner;