import React from 'react';
import './Logo.css';

const Logo = ({ size = 'large' }) => {
  const dimension = size === 'large' ? 120 : 80;
  
  return (
    <svg 
      className={`logo logo--${size}`} 
      width={dimension} 
      height={dimension} 
      viewBox="0 0 120 120" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="55" fill="#065952"/>
      <path d="M40 35h10v50h-10v-50z" fill="#FFFFFF"/>
      <path d="M70 35h10v25h-10v-25z" fill="#FFFFFF"/>
      <circle cx="45" cy="30" r="8" fill="#0ACCB1"/>
      <circle cx="75" cy="30" r="8" fill="#0ACCB1"/>
    </svg>
  );
};

export default Logo;