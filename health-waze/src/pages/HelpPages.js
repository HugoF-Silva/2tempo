import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import HelpWithAvailableTreatment from './help/HelpWithAvailableTreatment';
import HelpWithFullnessInfo from './help/HelpWithFullnessInfo';
// import HelpWithDoctorsOnCall from './help/HelpWithDoctorsOnCall';
// import HelpByAmountDoctors from './help/HelpByAmountDoctors';
import HelpByConfirmOrDenyDoctors from './help/HelpByConfirmOrDenyDoctors';
import HelpByConfirmOrDenyDrug from './help/HelpByConfirmOrDenyDrug';
import HelpAddNewMedicine from './help/HelpAddNewMedicine';
import { apiClient } from '../services/apiClient';
import './HelpPages.css';

const HelpPages = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { updateServerState } = useApp();
  
  const [helpPlan, setHelpPlan] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const centreId = searchParams.get('centre');
  const entryPoint = searchParams.get('entry') || 'cta';

    // Load help plan on mount
  useEffect(() => {
    const loadHelpPlan = async () => {
      if (!centreId) {
        navigate('/map');
        return;
      }

      try {
        const plan = await apiClient.getHelpPlan(centreId, entryPoint);
        setHelpPlan(plan);
        
        // Find current step based on URL
        const currentPath = location.pathname.split('/').pop();
        const stepIndex = plan.steps.findIndex(step => step.page === currentPath);
        if (stepIndex >= 0) {
          setCurrentStepIndex(stepIndex);
        }
      } catch (error) {
        console.error('Failed to load help plan:', error);
        navigate('/map');
      } finally {
        setIsLoading(false);
      }
    };

    loadHelpPlan();
  }, [centreId, entryPoint, location, navigate]);

  const navigateToStep = (index) => {
    if (!helpPlan || index < 0 || index >= helpPlan.steps.length) return;
    
    const step = helpPlan.steps[index];
    setCurrentStepIndex(index);
    navigate(`/help/${step.page}?centre=${centreId}&entry=${entryPoint}`);
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex === 0 
      ? helpPlan.steps.length - 1 
      : currentStepIndex - 1;
    navigateToStep(prevIndex);
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex === helpPlan.steps.length - 1 
      ? 0 
      : currentStepIndex + 1;
    navigateToStep(nextIndex);
  };

  const handleComplete = async (ctaResult) => {
    // Update balance if provided
    if (ctaResult?.balance !== undefined) {
      updateServerState({ balance: ctaResult.balance });
    }
    
    // Check if there are more steps or return to previous page
    if (helpPlan?.return_to) {
      navigate(helpPlan.return_to);
    } else {
      navigate('/map');
    }
  };

  if (isLoading || !helpPlan) {
    return <div className="loading-screen">Loading...</div>;
  }

  const currentStep = helpPlan.steps[currentStepIndex];
  const commonProps = {
    centreId,
    centreName: helpPlan.centre_name,
    entitlements: currentStep.entitlements || [],
    onPrevious: handlePrevious,
    onNext: handleNext,
    onComplete: handleComplete,
    showTutorial: entryPoint === 'cta' && currentStepIndex === 0
  };

  return (
    <div className="help-pages">
      <Routes>
        <Route 
          path="available-treatment" 
          element={<HelpWithAvailableTreatment {...commonProps} />} 
        />
        <Route 
          path="fullness" 
          element={<HelpWithFullnessInfo {...commonProps} />} 
        />
        <Route 
          path="doctors-on-call" 
          // element={<HelpWithDoctorsOnCall {...commonProps} />} 
        />
        <Route 
          path="amount-doctors" 
          // element={<HelpByAmountDoctors {...commonProps} />} 
        />
        <Route 
          path="confirm-deny-doctors" 
          element={<HelpByConfirmOrDenyDoctors {...commonProps} />} 
        />
        <Route 
          path="confirm-deny-drugs" 
          element={<HelpByConfirmOrDenyDrug {...commonProps} />} 
        />
        <Route 
          path="add-medicine" 
          element={<HelpAddNewMedicine {...commonProps} />} 
        />
      </Routes>
    </div>
  );
};

export default HelpPages;