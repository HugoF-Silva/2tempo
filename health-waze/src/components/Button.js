import React from 'react';
import './Button.css';

const Button = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary', 
  fullWidth = false 
}) => {
  return (
    <button
      className={`button button--${variant} ${fullWidth ? 'button--full-width' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;