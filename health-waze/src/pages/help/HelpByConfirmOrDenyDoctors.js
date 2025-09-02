import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import NavigationArrows from '../../components/NavigationArrows';
import PopupMessage from '../../components/PopupMessage';
import './HelpByConfirmOrDenyDoctors.css';

const HelpByConfirmOrDenyDoctors = ({
  centreId,
  centreName,
  entitlements,
  onPrevious,
  onNext,
  onComplete
}) => {
  const navigate = useNavigate();
  const { serverState, executeCTA } = useApp();
  
  const [doctors, setDoctors] = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [actionsThisHour, setActionsThisHour] = useState(0);
  
  const confirmEntitlement = entitlements.find(e => e.cta === 'help.doctor_confirm');
  const denyEntitlement = entitlements.find(e => e.cta === 'help.doctor_deny');
  const earnAmount = confirmEntitlement?.earn_amount || '8 minutes';
  const maxActionsPerHour = 1;

  const loadDoctors = useCallback(async () => {
    try {
      const response = await apiClient.getCentreReadData(centreId);
      setDoctors(response.doctors || []);
      setAvailableCount(response.doctorCount || 0);
      setActionsThisHour(response.doctorActionsThisHour || 0);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  }, [centreId]);

  // run automatically when centreId changes
  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);


  const handleBack = () => {
    navigate(-1);
  };

  const handleDoctorAction = async (doctorId, action) => {
    if (actionsThisHour >= maxActionsPerHour) {
      setMessage({
        type: 'info',
        text: `You already helped by ${action === 'confirm' ? 'confirming' : 'denying'} a Dr's presence at the current hour. Come back again later to help again`,
        actions: [{ label: 'Ok', action: 'close' }]
      });
      return;
    }

    const entitlement = action === 'confirm' ? confirmEntitlement : denyEntitlement;
    if (!entitlement || !entitlement.available || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await executeCTA(`help.doctor_${action}`, entitlement.token, {
        centre_id: centreId,
        doctor_id: doctorId,
        action
      });

      const validationTime = result.validation_due_at 
        ? new Date(result.validation_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '30 minutes';

      setMessage({
        type: 'success',
        text: `Congrats: You earned ${earnAmount}. Your info will be analyzed at ${validationTime}`,
        actions: [{ label: 'Receive', action: 'receive' }]
      });

      setActionsThisHour(actionsThisHour + 1);
      
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.',
        actions: [{ label: 'Ok', action: 'close' }]
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMessageAction = (action) => {
    if (action === 'receive') {
      // Don't complete the flow after one action - allow more
      loadDoctors(); // Refresh data
    }
    setMessage(null);
  };

  return (
    <div className="help-page help-confirm-deny-doctors">
      {/* Header */}
      <div className="help-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1 className="page-title">{centreName}</h1>
        <div className="header-actions">
          <AccountButton />
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>

      {/* Main content */}
      <div className="help-content">
        <p className="instruction-text">
          Other patients said that the doctors in the list below are on call.
        </p>

        {/* Doctors card */}
        <div className="doctors-card">
          <span className="doctor-icon">👤</span>
          <span className="doctor-count">{availableCount} available doctors</span>
        </div>

        <p className="sub-instruction">
          You can confirm if any of them really are or not
        </p>

        {/* Doctors list */}
        <div className="doctors-list">
          {doctors.map((doctor) => (
            <div key={doctor.id} className="doctor-item">
              <span className="doctor-name">{doctor.name}</span>
              <div className="doctor-actions">
                <button
                  className="action-button action-button--deny"
                  onClick={() => handleDoctorAction(doctor.id, 'deny')}
                  disabled={!denyEntitlement?.available || isSubmitting || actionsThisHour >= maxActionsPerHour}
                >
                  It isn't
                </button>
                <button
                  className="action-button action-button--confirm"
                  onClick={() => handleDoctorAction(doctor.id, 'confirm')}
                  disabled={!confirmEntitlement?.available || isSubmitting || actionsThisHour >= maxActionsPerHour}
                >
                  It is
                </button>
              </div>
            </div>
          ))}
          
          {doctors.length === 0 && (
            <p className="empty-message">No doctors reported yet</p>
          )}
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

export default HelpByConfirmOrDenyDoctors;