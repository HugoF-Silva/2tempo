import React from 'react';
import './TextInput.css';

const TextInput = ({ 
  value, 
  onChange, 
  placeholder, 
  maxLength = 300, 
  showCounter = false,
  variant = 'default' 
}) => {
  const handleChange = (e) => {
    const newValue = e.target.value.slice(0, maxLength);
    onChange(newValue);
  };

  return (
    <div className={`text-input-wrapper text-input-wrapper--${variant}`}>
      <textarea
        className={`text-input text-input--${variant}`}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
      />
      {showCounter && (
        <span className="char-counter">{value.length}/{maxLength}</span>
      )}
    </div>
  );
};

export default TextInput;