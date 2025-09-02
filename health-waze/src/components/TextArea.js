import React from 'react';
import './TextArea.css';

const TextArea = ({ 
  value, 
  onChange, 
  placeholder = '', 
  maxLength = 500,
  showCounter = true,
  className = '',
  disabled = false,
  rows = 4
}) => {
  const handleChange = (e) => {
    const newValue = e.target.value.slice(0, maxLength);
    onChange(newValue);
  };

  return (
    <div className={`textarea-wrapper ${className}`}>
      <textarea
        className="textarea"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        rows={rows}
      />
      {showCounter && (
        <span className="textarea-counter">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
};

export default TextArea;