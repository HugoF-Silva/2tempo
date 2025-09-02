import React from 'react';
import './NavigationArrows.css';

const NavigationArrows = ({ onPrevious, onNext, dimmed = false, hint = '' }) => {
  return (
    <div className={`navigation-arrows ${dimmed ? 'navigation-arrows--dimmed' : ''}`}>
      <button 
        className="nav-arrow nav-arrow--left" 
        onClick={onPrevious}
        aria-label="Previous"
      >
        ←
      </button>
      
      {hint && (
        <span className="nav-hint">{hint}</span>
      )}
      
      <button 
        className="nav-arrow nav-arrow--right" 
        onClick={onNext}
        aria-label="Next"
      >
        →
      </button>
    </div>
  );
};

export default NavigationArrows;