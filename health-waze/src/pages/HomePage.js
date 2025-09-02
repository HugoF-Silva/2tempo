import React from 'react';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';
import TextInput from '../components/TextInput';
import Button from '../components/Button';
import Tutorial from '../components/Tutorial';
import './HomePage.css';

const HomePage = () => {
  const { description, setDescription, navigateToMap, serverState } = useApp();
  
  const handleEnterClick = () => {
    navigateToMap(true);
  };

  const handleSkipClick = () => {
    navigateToMap(false);
  };

  return (
    <div className="home-page">
      {serverState.tutorial?.home && (
        <Tutorial steps={serverState.tutorial.home} />
      )}
      
      <div className="content-wrapper">
        <Logo size="large" />
        
        <h1 className="main-text">
          To recommend you a Health Center unit, please describe: 
          What are the symptoms? Or What are you looking for?
        </h1>
        
        <TextInput
          value={description}
          onChange={setDescription}
          placeholder="Describe your symptoms or needs..."
          maxLength={300}
          showCounter={true}
        />
        
        <Button
          variant="primary"
          onClick={handleEnterClick}
          disabled={description.length === 0}
          fullWidth
        >
          Enter
        </Button>
        
        <div className="divider">
          <span>or</span>
        </div>
        
        <Button
          variant="secondary"
          onClick={handleSkipClick}
          fullWidth
        >
          Skip to map health center unit pinpoints without a specific recommendation
        </Button>
      </div>
    </div>
  );
};

export default HomePage;