import React from 'react';
import './IconButton.css';

const IconButton = ({ icon, onClick, disabled = false, label }) => {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
};

export default IconButton;