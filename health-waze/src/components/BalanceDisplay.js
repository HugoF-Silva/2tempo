import React from 'react';
import './BalanceDisplay.css';

const BalanceDisplay = ({ balance = 0 }) => {
  const formatBalance = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="balance-display">
      <span className="balance-display__label">T$</span>
      <span className="balance-display__value">{formatBalance(balance)}</span>
    </div>
  );
};

export default BalanceDisplay;