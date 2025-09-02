import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDwellTime } from '../hooks/useDwellTime';
import AccountButton from '../components/AccountButton';
import BalanceDisplay from '../components/BalanceDisplay';
import SearchInput from '../components/SearchInput';
import StatusCard from '../components/StatusCard';
import MedicineList from '../components/MedicineList';
import TreatmentResults from '../components/TreatmentResults';
import Overlay from '../components/Overlay';
import { apiClient } from '../services/apiClient';
import './ReadWriteStatusPage.css';

const ReadWriteStatusPage = () => {
  const { id: centreId } = useParams();
  const navigate = useNavigate();
  const { serverState, executeCTA, checkNudges } = useApp();
  
  const [centreData, setCentreData] = useState(null);
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  const [showTreatmentResults, setShowTreatmentResults] = useState(false);
  const [treatmentResults, setTreatmentResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showHelpNudge, setShowHelpNudge] = useState(false);

  // Track dwell time for "help as I was helped" nudge
  const dwellTimeThresholds = [
    { id: 'treatment_idle_10s', seconds: 10, type: 'idle' }
  ];

  const handleDwellThreshold = async ({ id }) => {
    if (id === 'treatment_idle_10s' && showTreatmentResults) {
      const nudges = await checkNudges('availableTreatments', 10, ['treatment_search']);
      if (nudges?.overlays?.length > 0) {
        setShowHelpNudge(true);
      }
    }
  };

  const { resetActivity } = useDwellTime(
    showTreatmentResults ? handleDwellThreshold : null,
    showTreatmentResults ? dwellTimeThresholds : []
  );

  // Load centre data on mount
  const loadCentreData = useCallback(async () => {
    try {
      const response = await apiClient.getCentreReadData(centreId);
      setCentreData(response);
    } catch (error) {
      console.error('Failed to load centre data:', error);
    }
  }, [centreId]);

  useEffect(() => {
    loadCentreData();
  }, [loadCentreData]);



  const handleBack = () => {
    navigate('/map');
  };

  const handleTreatmentSearch = async () => {
    if (treatmentSearch.trim().length === 0) return;
    
    setIsSearching(true);
    resetActivity();
    
    try {
      const results = await apiClient.searchTreatments(centreId, treatmentSearch);
      setTreatmentResults(results);
      setShowTreatmentResults(true);
    } catch (error) {
      console.error('Treatment search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFullnessClick = () => {
    navigate(`/help/fullness?centre=${centreId}`);
  };

  const handleDoctorsClick = () => {
    navigate(`/help/confirm-deny-doctors?centre=${centreId}`);
  };

  const handleMedicineSearchFocus = () => {
    navigate(`/help/confirm-deny-drugs?centre=${centreId}`);
  };

  const handleMedicineAction = async (medicineId, action) => {
    const entitlement = serverState.entitlements.find(
      e => e.cta === `medicine.${action}` && e.centre_id === centreId
    );
    
    if (entitlement) {
      try {
        await executeCTA(`medicine.${action}`, entitlement.token, {
          centre_id: centreId,
          medicine_id: medicineId,
          action
        });
        // Refresh data after action
        await loadCentreData();
      } catch (error) {
        console.error(`Medicine ${action} failed:`, error);
      }
    }
  };

  const handleAddNewMedicine = () => {
    navigate(`/help/add-medicine?centre=${centreId}`);
  };

  const handleHelpNudgeAction = (action) => {
    setShowHelpNudge(false);
    if (action === 'help') {
      navigate(`/help/available-treatment?centre=${centreId}`);
    }
  };

  if (!centreData) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="read-write-status-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1 className="page-title">{centreData.name}</h1>
        <div className="header-actions">
          <AccountButton />
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>

      {/* Treatment Search */}
      <div className="treatment-search-section">
        <SearchInput
          value={treatmentSearch}
          onChange={setTreatmentSearch}
          onSearch={handleTreatmentSearch}
          placeholder="Search here if they treat a specific case"
          disabled={isSearching}
        />
      </div>

      {/* Status Cards Row with bottom arrows */}
      <div className="status-cards-row status-cards-row--interactive">
        <StatusCard
          type="fullness"
          status={centreData.status}
          count={centreData.peopleCount}
          onClick={handleFullnessClick}
          showArrows={true}
        />
        <StatusCard
          type="doctors"
          count={centreData.doctorCount}
          onClick={handleDoctorsClick}
          showArrows={true}
        />
      </div>

      {/* Medicine Section with actions */}
      <div className="medicine-section medicine-section--interactive">
        <SearchInput
          value={medicineSearch}
          onChange={setMedicineSearch}
          onFocus={handleMedicineSearchFocus}
          placeholder="medicines"
          icon="search"
        />
        
        <h3 className="medicine-title">Patients told they have:</h3>
        
        <MedicineList
          medicines={centreData.medicines || []}
          readonly={false}
          onAction={handleMedicineAction}
          canConfirm={serverState.entitlements.some(e => e.cta === 'medicine.confirm')}
          canDeny={serverState.entitlements.some(e => e.cta === 'medicine.deny')}
        />
        
        <button 
          className="add-medicine-button"
          onClick={handleAddNewMedicine}
        >
          + add a new one not included
        </button>
      </div>

      {/* Treatment Results Modal */}
      {showTreatmentResults && treatmentResults && (
        <TreatmentResults
          centreName={centreData.name}
          query={treatmentSearch}
          results={treatmentResults}
          onClose={() => {
            setShowTreatmentResults(false);
            resetActivity();
          }}
          onNewSearch={(query) => {
            setTreatmentSearch(query);
            handleTreatmentSearch();
          }}
        />
      )}

      {/* Help nudge overlay */}
      {showHelpNudge && (
        <Overlay
          type="nudge"
          anchor="balance"
          message="Did you know this info was provided by another patient?"
          actions={[
            { id: 'help', label: 'Help as I was helped', variant: 'primary' },
            { id: 'close', label: '×', variant: 'close' }
          ]}
          onAction={handleHelpNudgeAction}
          onClose={() => setShowHelpNudge(false)}
        />
      )}
    </div>
  );
};

export default ReadWriteStatusPage;