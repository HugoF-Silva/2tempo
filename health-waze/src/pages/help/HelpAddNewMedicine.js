import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import Button from '../../components/Button';
import PopupMessage from '../../components/PopupMessage';
import './HelpAddNewMedicine.css';

const HelpAddNewMedicine = ({
  centreId,
  centreName,
  entitlements,
  onComplete
}) => {
  const navigate = useNavigate();
  const { serverState } = useApp();
  
  const [medicines, setMedicines] = useState(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  
  const entitlement = entitlements.find(e => e.cta === 'help.drug_add');
  const earnAmount = entitlement?.earn_amount || '10 minutes';
  const maxMedicines = 5;

  const handleBack = () => {
    navigate(-1);
  };

  const handleAddEntry = () => {
    if (medicines.length < maxMedicines) {
      setMedicines([...medicines, '']);
    }
  };

  const handleRemoveEntry = (index) => {
    const newMedicines = medicines.filter((_, i) => i !== index);
    setMedicines(newMedicines.length > 0 ? newMedicines : ['']);
  };

  const handleMedicineChange = (index, value) => {
    const newMedicines = [...medicines];
    newMedicines[index] = value;
    setMedicines(newMedicines);
  };

  const isValidForSubmit = () => {
    return medicines.some(med => med.trim().length > 0);
  };

  const handleSubmit = async () => {
    if (!isValidForSubmit() || !entitlement || isSubmitting) return;

    // const validMedicines = medicines.filter(med => med.trim().length > 0);
    
    setIsSubmitting(true);
    try {
      // const result = await executeCTA('help.drug_add', entitlement.token, {
      //   centre_id: centreId,
      //   medicines: validMedicines
      // });

      setMessage({
        type: 'success',
        text: `Congrats: You earned ${earnAmount}`,
        actions: [{ label: 'Receive', action: 'receive' }]
      });

      // Clear form
      setMedicines(['']);
      
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

  return (
    <div className="help-page help-add-medicine">
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
        <div className="input-section">
          <p className="input-label">
            Write here the medicine's name they have
          </p>
          
          <div className="medicines-input-list">
            {medicines.map((medicine, index) => (
              <div key={index} className="medicine-input-item">
                <input
                  type="text"
                  className="medicine-input"
                  value={medicine}
                  onChange={(e) => handleMedicineChange(index, e.target.value)}
                  placeholder="Medicine name"
                />
                {medicines.length > 1 && (
                  <button
                    className="remove-button"
                    onClick={() => handleRemoveEntry(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button
            className="add-more-button"
            onClick={handleAddEntry}
            disabled={medicines.length >= maxMedicines}
          >
            Tell about one more
          </button>
          
          {medicines.length >= maxMedicines && (
            <p className="limit-message">
              Maximum limit of {maxMedicines} medicines reached
            </p>
          )}
        </div>

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!isValidForSubmit() || !entitlement?.available || isSubmitting}
          centered
        >
          Send
        </Button>
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

export default HelpAddNewMedicine;