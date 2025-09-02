import React from 'react';
import './StatusCard.css';

const StatusCard = ({ 
  type = 'fullness', 
  status, 
  count, 
  onClick, 
  showArrows = false 
}) => {
  const getStatusColor = () => {
    if (type === 'fullness') {
      const colors = {
        full: '#dc2626',
        average: '#eab308',
        empty: '#16a34a'
      };
      return colors[status] || '#999';
    }
    return '#065952';
  };

  const getStatusText = () => {
    if (type === 'fullness') {
      const texts = {
        full: `FULL > ${count || 40} people`,
        average: 'Average',
        empty: `Few < ${count || 10}`
      };
      return texts[status] || 'Unknown';
    }
    return `${count || 0} available doctors`;
  };

  const cardStyle = type === 'fullness' ? {
    backgroundColor: getStatusColor() + '20',
    borderColor: getStatusColor()
  } : {};

  return (
    <div 
      className={`status-card status-card--${type}`}
      style={cardStyle}
      onClick={onClick}
    >
      {type === 'doctors' && (
        <span className="status-card__icon">👤</span>
      )}
      
      <span 
        className="status-card__text"
        style={type === 'fullness' ? { color: getStatusColor() } : {}}
      >
        {getStatusText()}
      </span>
      
      {showArrows && (
        <>
          <button className="corner-arrow corner-arrow--left" aria-label="Previous">
            ←
          </button>
          <button className="corner-arrow corner-arrow--right" aria-label="Next">
            →
          </button>
        </>
      )}
    </div>
  );
};

export default StatusCard;