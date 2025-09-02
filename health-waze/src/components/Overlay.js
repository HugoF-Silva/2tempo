import React from 'react';
import './Overlay.css';

const Overlay = ({ 
  pin,
  type = 'pin',
  message,
  copy_key,
  actions = [],
  position,
  anchor,
  onClose,
  onAction,
  onDiscover,
  onMoreInfo,
  onGoToCentre,
  canDiscover
}) => {
  // Pin overlay specific rendering
  if (type === 'pin' && pin) {
    const statusText = {
      full: 'Full > 40 people',
      average: 'Average',
      empty: 'Few < 10'
    };

    return (
      <div 
        className="overlay overlay--pin"
        style={{
          top: position?.top,
          left: position?.left
        }}
      >
        <button className="overlay__close" onClick={onClose}>×</button>
        
        <h3 className="overlay__title">{pin.name}</h3>
        
        {pin.locked ? (
          <>
            <p className="overlay__message">
              Use T$ to know if this centre is full or not
            </p>
            <p className="overlay__cost">Cost: 60 minutes</p>
            <div className="overlay__actions">
              <button 
                className="overlay__button overlay__button--secondary"
                onClick={onGoToCentre}
              >
                go to centre
              </button>
              <button 
                className="overlay__button overlay__button--primary"
                onClick={onDiscover}
                disabled={!canDiscover}
              >
                discover
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="overlay__status">
              Status: {statusText[pin.status]}
            </p>
            <p className="overlay__update">
              Last Updt: {pin.lastUpdate || '12:00 am'}
            </p>
            <div className="overlay__actions">
              <button 
                className="overlay__button overlay__button--secondary"
                onClick={onGoToCentre}
              >
                go to centre
              </button>
              <button 
                className="overlay__button overlay__button--primary"
                onClick={onMoreInfo}
              >
                + info
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Generic overlay rendering (for CTAs, nudges, etc.)
  return (
    <div 
      className={`overlay overlay--${type} ${anchor ? `overlay--anchor-${anchor}` : ''}`}
      style={{
        top: position?.top,
        left: position?.left
      }}
    >
      {onClose && (
        <button className="overlay__close" onClick={onClose}>×</button>
      )}
      
      {(message || copy_key) && (
        <p className="overlay__message">
          {message || copy_key}
        </p>
      )}
      
      {actions.length > 0 && (
        <div className="overlay__actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`overlay__button overlay__button--${action.variant || 'primary'}`}
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Overlay;