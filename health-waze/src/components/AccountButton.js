import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './AccountButton.css';

const AccountButton = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();

  const handleClick = () => {
    if (isAuthenticated) {
      navigate('/account/profile');
    } else {
      navigate('/account/signin');
    }
  };

  return (
    <button 
      className="account-button"
      onClick={handleClick}
    >
      {isAuthenticated ? 'My Account' : 'Sign In'}
    </button>
  );
};

export default AccountButton;