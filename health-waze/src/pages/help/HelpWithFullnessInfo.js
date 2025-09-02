import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import NavigationArrows from '../../components/NavigationArrows';
import PopupMessage from '../../components/PopupMessage';
import './HelpWithFullnessInfo.css';

const HelpWithFullnessInfo = ({
  centreId,
  centreName,
  entitlements,
  onPrevious,
  onNext,
  onComplete
}) => {
  const navigate = useNavigate();
  const { serverState, executeCTA } = useApp();
  
  const [fullnessHistory, setFullnessHistory] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  
  const entitlement = entitlements.find(e => e.cta === 'help.fullness_info');
  const earnAmount = entitlement?.earn_amount || '35 minutes';

  const loadFullnessHistory = useCallback(async () => {
    try {
      const response = await apiClient.getCentreReadData(centreId);
      setFullnessHistory(response.fullnessHistory || []);
    } catch (error) {
      console.error('Failed to load fullness history:', error);
    }
  }, [centreId]);

  // Run on mount / whenever centreId changes
  useEffect(() => {
    loadFullnessHistory();
  }, [loadFullnessHistory]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleStatusSelect = async (status) => {
    if (!entitlement?.available || isSubmitting) {
      setMessage({
        type: 'info',
        text: 'You already informed fullness at the current hour. Come back again later to help again',
        actions: [{ label: 'Ok', action: 'close' }]
      });
      return;
    }

    setSelectedStatus(status);
    setIsSubmitting(true);

    try {
      const result = await executeCTA('help.fullness_info', entitlement.token, {
        centre_id: centreId,
        status
      });

      const validationTime = result.validation_due_at 
        ? new Date(result.validation_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '30 minutes';

      setMessage({
        type: 'success',
        text: `Congrats: You earned ${earnAmount}. Your info will be analyzed at ${validationTime}`,
        actions: [{ label: 'Receive', action: 'receive' }]
      });

      // Refresh history
      await loadFullnessHistory();
      
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.',
        actions: [{ label: 'Ok', action: 'close' }]
      });
    } finally {
      setIsSubmitting(false);
      setSelectedStatus(null);
    }
  };

  const handleMessageAction = (action) => {
    if (action === 'receive') {
      onComplete({ balance: serverState.balance });
    }
    setMessage(null);
  };

  const getStatusColor = (status) => {
    const colors = {
      full: '#dc2626',
      average: '#eab308',
      empty: '#16a34a'
    };
    return colors[status] || '#999';
  };

  const getStatusText = (status) => {
    const texts = {
      full: 'Full > 40 people',
      average: 'Average',
      empty: 'Few < 10'
    };
    return texts[status] || status;
  };

  return (
    <div className="help-page help-fullness-info">
      {/* Header */}
      <div className="help-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1 className="page-title">{centreName}</h1>
        <div className="header-actions">
          <AccountButton />
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>

      {/* Fullness History */}
      <div className="fullness-history">
        {fullnessHistory.map((entry, index) => (
          <div 
            key={index}
            className="history-entry"
            style={{ backgroundColor: getStatusColor(entry.status) + '20' }}
          >
            <span className="history-time">{entry.time}</span>
            <span 
              className="history-status"
              style={{ color: getStatusColor(entry.status) }}
            >
              {getStatusText(entry.status)}
            </span>
          </div>
        ))}
        
        {/* Last update card */}
        <div className="last-update-card">
          <h3>Last Update</h3>
          <div className="update-time">
            {fullnessHistory[0]?.time || 'No updates yet'}
          </div>
        </div>
      </div>

      {/* Status Selection */}
      <div className="status-selection">
        <h3 className="selection-title">
          Inform how full it is at the moment:
        </h3>
        
        <div className="status-options">
          <button
            className={`status-card status-card--full ${selectedStatus === 'full' ? 'selected' : ''}`}
            onClick={() => handleStatusSelect('full')}
            disabled={!entitlement?.available || isSubmitting}
          >
            <span className="status-icon" style={{ backgroundColor: getStatusColor('full') }} />
            <span className="status-label">Full &gt; 40 people</span>
          </button>
          
          <button
            className={`status-card status-card--average ${selectedStatus === 'average' ? 'selected' : ''}`}
            onClick={() => handleStatusSelect('average')}
            disabled={!entitlement?.available || isSubmitting}
          >
            <span className="status-icon" style={{ backgroundColor: getStatusColor('average') }} />
            <span className="status-label">Average</span>
          </button>
          
          <button
            className={`status-card status-card--empty ${selectedStatus === 'empty' ? 'selected' : ''}`}
            onClick={() => handleStatusSelect('empty')}
            disabled={!entitlement?.available || isSubmitting}
          >
            <span className="status-icon" style={{ backgroundColor: getStatusColor('empty') }} />
            <span className="status-label">Few &lt; 10</span>
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      <NavigationArrows 
        onPrevious={onPrevious} 
        onNext={onNext}
      />

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

export default HelpWithFullnessInfo;