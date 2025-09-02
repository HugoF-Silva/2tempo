import React, { useState } from 'react';
import './SearchInput.css';

const SearchInput = ({ 
  value, 
  onChange, 
  onSearch, 
  onFocus,
  placeholder = '', 
  icon = null,
  disabled = false 
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && onSearch && value.trim()) {
      onSearch();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={`search-input-wrapper ${isFocused ? 'search-input-wrapper--focused' : ''}`}>
      {icon && (
        <span className="search-input__icon">
          {icon === 'search' ? '🔍' : icon}
        </span>
      )}
      
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
      
      {onSearch && value.trim() && (
        <button 
          className="search-input__button"
          onClick={onSearch}
          disabled={disabled}
        >
          Send
        </button>
      )}
    </div>
  );
};

export default SearchInput;