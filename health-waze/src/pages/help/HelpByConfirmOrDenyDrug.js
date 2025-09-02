import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import SearchInput from '../../components/SearchInput';
import NavigationArrows from '../../components/NavigationArrows';
import PopupMessage from '../../components/PopupMessage';
import './HelpByConfirmOrDenyDrug.css';

const HelpByConfirmOrDenyDrug = ({
  centreId,
  centreName,
  entitlements,
  onPrevious,
  onNext,
  onComplete
}) => {
  const navigate = useNavigate();
  const { serverState, executeCTA } = useApp();
  
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [actionsThisHour, setActionsThisHour] = useState(0);
  
  const confirmEntitlement = entitlements.find(e => e.cta === 'help.drug_confirm');
  const denyEntitlement = entitlements.find(e => e.cta === 'help.drug_deny');
  const earnAmount = confirmEntitlement?.earn_amount || '8 minutes';
  const maxActionsPerHour = 2;

  const loadMedicines = useCallback(async () => {
    try {
      const response = await apiClient.getCentreReadData(centreId);
      setMedicines(response.medicines || []);
      setActionsThisHour(response.drugActionsThisHour || 0);
    } catch (error) {
      console.error('Failed to load medicines:', error);
    }
  }, [centreId]);

  // run when centreId changes
  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  useEffect(() => {
    // Filter medicines based on search
    if (searchQuery) {
      const filtered = medicines.filter(med => 
        med.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMedicines(filtered);
    } else {
      setFilteredMedicines(medicines);
    }
  }, [searchQuery, medicines]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleDrugAction = async (drugId, action) => {
    if (actionsThisHour >= maxActionsPerHour) {
      setMessage({
        type: 'info',
        text: `You already helped by ${action === 'confirm' ? 'confirming' : 'denying'} medicines at the current hour. Come back again later to help again`,
        actions: [{ label: 'Ok', action: 'close' }]
      });
      return;
    }

    const entitlement = action === 'confirm' ? confirmEntitlement : denyEntitlement;
    if (!entitlement || !entitlement.available || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await executeCTA(`help.drug_${action}`, entitlement.token, {
        centre_id: centreId,
        drug_id: drugId,
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

  const handleAddNewMedicine = () => {
    navigate(`/help/add-medicine?centre=${centreId}`);
  };

  const handleMessageAction = (action) => {
    if (action === 'receive') {
      // Don't complete flow - allow more actions
      loadMedicines();
    }
    setMessage(null);
  };

  return (
    <div className="help-page help-confirm-deny-drug">
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
        {/* Search bar */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="medicines"
          icon="search"
        />

        <h3 className="section-title">Patients told they have:</h3>

        {/* Medicines list */}
        <div className="medicines-list">
          {filteredMedicines.map((medicine) => (
            <div key={medicine.id} className="medicine-item">
              <span className="medicine-name">{medicine.name}</span>
              <div className="medicine-actions">
                <button
                  className="action-button action-button--deny"
                  onClick={() => handleDrugAction(medicine.id, 'deny')}
                  disabled={!denyEntitlement?.available || isSubmitting || actionsThisHour >= maxActionsPerHour}
                >
                  They don't
                </button>
                <button
                  className="action-button action-button--confirm"
                  onClick={() => handleDrugAction(medicine.id, 'confirm')}
                  disabled={!confirmEntitlement?.available || isSubmitting || actionsThisHour >= maxActionsPerHour}
                >
                  They have
                </button>
              </div>
            </div>
          ))}
          
          {searchQuery && filteredMedicines.length === 0 && (
            <div className="no-results">
              <p>Not found</p>
              <button 
                className="add-new-button"
                onClick={handleAddNewMedicine}
              >
                + add a new one not included
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="bottom-actions">
        <NavigationArrows 
          onPrevious={onPrevious} 
          onNext={onNext}
        />
        <button 
          className="add-new-center-button"
          onClick={handleAddNewMedicine}
        >
          + add a new one not included
        </button>
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

export default HelpByConfirmOrDenyDrug;