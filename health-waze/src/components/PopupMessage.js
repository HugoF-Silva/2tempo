import React from 'react';
import './PopupMessage.css';

const PopupMessage = ({ type = 'info', text, actions = [], onAction }) => {
  const handleAction = (action) => {
    if (onAction) {
      onAction(action);
    }
  };

  const handleBackdropClick = () => {
    // If there's a close action, trigger it on backdrop click
    const closeAction = actions.find(a => a.action === 'close' || a.action === 'ok');
    if (closeAction) {
      handleAction(closeAction.action);
    }
  };

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div 
        className={`popup-message popup-message--${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-message__content">
          <p className="popup-message__text">{text}</p>
          
          {actions.length > 0 && (
            <div className="popup-message__actions">
              {actions.map((action, index) => (
                <button
                  key={index}
                  className={`popup-message__button popup-message__button--${action.variant || 'primary'}`}
                  onClick={() => handleAction(action.action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopupMessage;