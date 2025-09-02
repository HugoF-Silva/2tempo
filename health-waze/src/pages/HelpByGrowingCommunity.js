import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/apiClient';
import AccountButton from '../components/AccountButton';
import BalanceDisplay from '../components/BalanceDisplay';
import PopupMessage from '../components/PopupMessage';
import './HelpByGrowingCommunity.css';

const HelpByGrowingCommunity = () => {
  const navigate = useNavigate();
  const { serverState } = useApp();
  
  const [referralData, setReferralData] = useState({
    link: '',
    usedCount: 0,
    maxCount: 2
  });
  const [isCopied, setIsCopied] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const response = await apiClient.getReferralLink();
      setReferralData({
        link: response.link,
        usedCount: response.used_count,
        maxCount: response.max_count
      });
    } catch (error) {
      console.error('Failed to load referral data:', error);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleCopyLink = () => {
    if (referralData.link) {
      navigator.clipboard.writeText(referralData.link);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSendLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Health Waze',
        text: 'Save time finding healthcare with this app!',
        url: referralData.link
      }).catch(err => console.log('Share cancelled'));
    } else {
      // Fallback - copy to clipboard
      handleCopyLink();
      setMessage({
        type: 'info',
        text: 'Link copied! Share it with friends and family.',
        actions: [{ label: 'Ok', action: 'close' }]
      });
    }
  };

  const handleMessageAction = (action) => {
    setMessage(null);
  };

  return (
    <div className="help-growing-community">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1 className="page-title">Grow Community</h1>
        <div className="header-actions">
          <AccountButton />
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>

      {/* Main content */}
      <div className="grow-content">
        <div className="main-card">
          <h2 className="card-title">Grow community!</h2>
          <p className="card-subtitle">
            $ave TIME when someone creates an account through your link.
          </p>
        </div>

        {/* Link box */}
        <div className="link-section">
          <div className="link-box">
            <input 
              type="text" 
              value={referralData.link} 
              readOnly 
              className="link-input"
            />
            <button 
              className="copy-button"
              onClick={handleCopyLink}
            >
              {isCopied ? '✓' : '📋'}
            </button>
          </div>
          
          {isCopied && (
            <span className="copy-feedback">Copied!</span>
          )}
        </div>

        {/* Usage counter */}
        <div className="usage-counter">
          <p className="counter-text">
            Unique people limit who can use: {referralData.usedCount}/{referralData.maxCount}
          </p>
          <p className="counter-note">
            The link renews every month
          </p>
        </div>

        {/* Send button */}
        <button 
          className="send-link-button"
          onClick={handleSendLink}
          disabled={referralData.usedCount >= referralData.maxCount}
        >
          Send link to someone
        </button>

        {/* Info about earnings */}
        <div className="earnings-info">
          <p>Earn <strong>50 minutes</strong> for each person who creates an account</p>
          <p>Both you and they receive the bonus!</p>
        </div>
      </div>

      {/* Popup messages */}
      {message && (
        <PopupMessage
          type={message.type}
          text={message.text}
          actions={message.actions}
          onAction={handleMessageAction}
        />
      )}
    </div>
  );
};

export default HelpByGrowingCommunity;