import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AccountButton from '../components/AccountButton';
import BalanceDisplay from '../components/BalanceDisplay';
import SearchInput from '../components/SearchInput';
import StatusCard from '../components/StatusCard';
import MedicineList from '../components/MedicineList';
import TreatmentResults from '../components/TreatmentResults';
import './ReadStatusPage.css';
import { apiClient } from '../services/apiClient';

const ReadStatusPage = () => {
  const { id: centreId } = useParams();
  const navigate = useNavigate();
  const { serverState } = useApp();
  
  const [centreData, setCentreData] = useState(null);
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  const [showTreatmentResults, setShowTreatmentResults] = useState(false);
  const [treatmentResults, setTreatmentResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Load centre data on mount
  useEffect(() => {

      const loadCentreData = async () => {
    try {
      const response = await apiClient.getCentreReadData(centreId);
      setCentreData(response);
    } catch (error) {
      console.error('Failed to load centre data:', error);
    }
  };
  
    loadCentreData();
  }, [centreId]);

  const handleBack = () => {
    navigate('/map');
  };

  const handleTreatmentSearch = async () => {
    if (treatmentSearch.trim().length === 0) return;
    
    setIsSearching(true);
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
    navigate(`/centre/${centreId}/fullness`);
  };

  const handleDoctorsClick = () => {
    navigate(`/centre/${centreId}/doctors`);
  };

  const handleMedicineSearchFocus = () => {
    navigate(`/centre/${centreId}/medicines`);
  };

  if (!centreData) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="read-status-page">
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

      {/* Status Cards Row */}
      <div className="status-cards-row">
        <StatusCard
          type="fullness"
          status={centreData.status}
          count={centreData.peopleCount}
          onClick={handleFullnessClick}
        />
        <StatusCard
          type="doctors"
          count={centreData.doctorCount}
          onClick={handleDoctorsClick}
        />
      </div>

      {/* Medicine Section */}
      <div className="medicine-section">
        <SearchInput
          value={medicineSearch}
          onChange={setMedicineSearch}
          onFocus={handleMedicineSearchFocus}
          placeholder="medicines"
          icon="search"
        />
        
        <h3 className="medicine-title">Patients said they have:</h3>
        
        <MedicineList
          medicines={centreData.medicines || []}
          readonly={true}
        />
      </div>

      {/* Treatment Results Modal */}
      {showTreatmentResults && treatmentResults && (
        <TreatmentResults
          centreName={centreData.name}
          query={treatmentSearch}
          results={treatmentResults}
          onClose={() => setShowTreatmentResults(false)}
          onNewSearch={(query) => {
            setTreatmentSearch(query);
            handleTreatmentSearch();
          }}
        />
      )}
    </div>
  );
};

export default ReadStatusPage;