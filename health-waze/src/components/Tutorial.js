import React, { useState, useEffect } from 'react';
import './Tutorial.css';

const Tutorial = ({ steps, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!steps || steps.length === 0) {
      setIsActive(false);
      return;
    }
  }, [steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsActive(false);
      if (onComplete) onComplete();
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    if (onComplete) onComplete();
  };

  if (!isActive || !steps || steps.length === 0) return null;

  const step = steps[currentStep];

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-backdrop" />
      
      {/* Highlight element if specified */}
      {step.highlight && (
        <div 
          className="tutorial-highlight"
          style={{
            top: step.highlight.top,
            left: step.highlight.left,
            width: step.highlight.width,
            height: step.highlight.height
          }}
        />
      )}
      
      {/* Tutorial content */}
      <div 
        className="tutorial-content"
        style={{
          top: step.position?.top || '50%',
          left: step.position?.left || '50%',
          transform: step.position ? 'none' : 'translate(-50%, -50%)'
        }}
      >
        {step.message && (
          <div className="tutorial-message">
            {step.message}
          </div>
        )}
        
        {step.finger && (
          <div 
            className="tutorial-finger"
            style={{
              top: step.finger.top,
              left: step.finger.left,
              animationName: step.finger.animation || 'tap'
            }}
          >
            👆
          </div>
        )}
        
        <div className="tutorial-actions">
          {currentStep > 0 && (
            <button 
              className="tutorial-button tutorial-button--secondary"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </button>
          )}
          
          <button 
            className="tutorial-button tutorial-button--primary"
            onClick={handleNext}
          >
            {currentStep < steps.length - 1 ? 'Next' : 'Got it'}
          </button>
          
          {currentStep === 0 && steps.length > 1 && (
            <button 
              className="tutorial-button tutorial-button--text"
              onClick={handleSkip}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Tutorial;