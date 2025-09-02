import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import TextArea from '../../components/TextArea';
import Button from '../../components/Button';
import NavigationArrows from '../../components/NavigationArrows';
import Tutorial from '../../components/Tutorial';
import PopupMessage from '../../components/PopupMessage';
import './HelpWithAvailableTreatment.css';

const HelpWithAvailableTreatment = ({
  centreId,
  centreName,
  entitlements,
  onPrevious,
  onNext,
  onComplete,
  showTutorial
}) => {
  const navigate = useNavigate();
  const { serverState } = useApp();
  
  const [description, setDescription] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [dialogResponse, setDialogResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [tutorialActive, setTutorialActive] = useState(showTutorial);

  const entitlement = entitlements.find(e => e.cta === 'help.treatment_available');
  const earnAmount = entitlement?.earn_amount || '30 minutes';

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = async () => {
    if (description.trim().length === 0 || !entitlement) return;
    
    // Check if already helped today
    if (!entitlement.available) {
      setMessage({
        type: 'info',
        text: 'You already explained about your visit today. Thank you!',
        actions: [{ label: 'Ok', action: 'close' }]
      });
      return;
    }
    
    setShowDialog(true);
  };

  const handleDialogSubmit = async () => {
    if (!dialogResponse || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // const result = await executeCTA('help.treatment_available', entitlement.token, {
      //   centre_id: centreId,
      //   description,
      //   has_treatment: dialogResponse
      // });
      
      setShowDialog(false);
      setMessage({
        type: 'success',
        text: `Congrats: You earned ${earnAmount}`,
        actions: [{ label: 'Receive', action: 'receive' }]
      });
      
      // Clear form after success
      setDescription('');
      setDialogResponse('');
      
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
      onComplete({ balance: serverState.balance });
    }
    setMessage(null);
  };

  const tutorialSteps = [
    {
      message: 'Touch the arrows to see other ways of earning T$',
      highlight: { selector: '.navigation-arrows' },
      position: { bottom: '100px', left: '50%' }
    }
  ];

  return (
    <div className="help-page help-available-treatment">
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
        <div className="instruction-box">
          To earn <strong>{earnAmount}</strong>, explain here what you went to the {centreName} for.
        </div>

        <TextArea
          value={description}
          onChange={setDescription}
          placeholder="Write here..."
          maxLength={500}
          className="treatment-input"
        />

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={description.trim().length === 0 || !entitlement?.available}
          centered
        >
          Send
        </Button>
      </div>

      {/* Navigation arrows */}
      <NavigationArrows 
        onPrevious={onPrevious} 
        onNext={onNext}
        dimmed={tutorialActive}
      />

      {/* Dialog for treatment confirmation */}
      {showDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog-header">
              <button className="back-button" onClick={() => setShowDialog(false)}>←</button>
              <h2>{centreName}</h2>
              <div className="header-actions">
                <AccountButton />
                <BalanceDisplay balance={serverState.balance} />
              </div>
            </div>
            
            <div className="dialog-content">
              <p className="dialog-question">
                At {centreName}, do they have treatment for what you explained?
              </p>
              
              <div className="dialog-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="treatment"
                    value="yes"
                    checked={dialogResponse === 'yes'}
                    onChange={(e) => setDialogResponse(e.target.value)}
                  />
                  <span>Yes</span>
                </label>
                
                <label className="radio-option">
                  <input
                    type="radio"
                    name="treatment"
                    value="no"
                    checked={dialogResponse === 'no'}
                    onChange={(e) => setDialogResponse(e.target.value)}
                  />
                  <span>No</span>
                </label>
                
                <label className="radio-option">
                  <input
                    type="radio"
                    name="treatment"
                    value="unknown"
                    checked={dialogResponse === 'unknown'}
                    onChange={(e) => setDialogResponse(e.target.value)}
                  />
                  <span>I don't know</span>
                </label>
              </div>
              
              <Button
                variant="primary"
                onClick={handleDialogSubmit}
                disabled={!dialogResponse || isSubmitting}
                centered
              >
                Send
              </Button>
            </div>
            
            <NavigationArrows 
              onPrevious={onPrevious} 
              onNext={onNext}
            />
          </div>
        </div>
      )}

      {/* Tutorial */}
      {tutorialActive && (
        <Tutorial
          steps={tutorialSteps}
          onComplete={() => setTutorialActive(false)}
        />
      )}

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

export default HelpWithAvailableTreatment;