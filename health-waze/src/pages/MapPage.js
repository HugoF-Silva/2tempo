import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDwellTime } from '../hooks/useDwellTime';
import Logo from '../components/Logo';
import TextInput from '../components/TextInput';
import IconButton from '../components/IconButton';
import InfoBanner from '../components/InfoBanner';
import HealthMap from '../components/HealthMap';
import AccountButton from '../components/AccountButton';
import BalanceDisplay from '../components/BalanceDisplay';
import Overlay from '../components/Overlay';
import Tutorial from '../components/Tutorial';
import LocationPermissionModal from '../components/LocationPermissionModal';
import { RefreshIcon } from '../components/Icons';
import './MapPage.css';

const MapPage = () => {
  const navigate = useNavigate();
  const {
    serverState,
    description,
    setDescription,
    userLocation,
    isAuthenticated,
    openCentre,
    executeCTA,
    checkNudges,
    navigateToMap
  } = useApp();
  
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track dwell time for nudges
  const dwellTimeThresholds = [
    { id: 'idle_3min', seconds: 180, type: 'idle' }
  ];

  const handleDwellThreshold = useCallback(async ({ id }) => {
    if (id === 'idle_3min' && !isAuthenticated) {
      await checkNudges('map', 180, []);
    }
  }, [checkNudges, isAuthenticated]);

  const { resetActivity } = useDwellTime(handleDwellThreshold, dwellTimeThresholds);

  // Request location on mount if not already available
  useEffect(() => {
    if (!userLocation && !showLocationModal && serverState.pins.length === 0) {
      setShowLocationModal(true);
    }
  }, [userLocation, showLocationModal, serverState.pins.length]);

  // Handle location permission response
  const handleLocationResponse = useCallback(async (granted) => {
    setShowLocationModal(false);
   if (granted && serverState.pins.length === 0) {
     await navigateToMap(description.length > 0);
   }
  }, [navigateToMap, description, serverState.pins.length]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    resetActivity();
    await navigateToMap(description.length > 0);
    setIsRefreshing(false);
  };

  // Handle pin click
  const handlePinClick = useCallback((pin) => {
    setSelectedPin(pin);
    resetActivity();
  }, [resetActivity]);

  // Handle discover action
  const handleDiscover = useCallback(async () => {
    if (!selectedPin) return;
    
    const entitlement = serverState.entitlements.find(
      e => e.cta === 'discover' && e.centre_id === selectedPin.id
    );
    
    if (entitlement) {
      try {
        await executeCTA('discover', entitlement.token, {
          centre_id: selectedPin.id
        });
        // Refresh map data after discovery
        await navigateToMap(description.length > 0);
      } catch (error) {
        console.error('Discover failed:', error);
      }
    }
    
    setSelectedPin(null);
  }, [selectedPin, serverState.entitlements, executeCTA, navigateToMap, description]);

  // Handle +info action
  const handleMoreInfo = useCallback(async () => {
    if (!selectedPin) return;
    
    try {
      await openCentre(selectedPin.id);
    } catch (error) {
      console.error('Open centre failed:', error);
    }
    
    setSelectedPin(null);
  }, [selectedPin, openCentre]);

  // Handle go to centre action
  const handleGoToCentre = useCallback(() => {
    if (!selectedPin) return;
    
    // Open navigation modal/sheet
    const destinations = ['Google Maps', 'Waze', 'Uber'];
    const choice = prompt(`Open with:\n${destinations.join('\n')}`);
    
    if (choice) {
      const urls = {
        'Google Maps': userLocation 
          ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${selectedPin.lat},${selectedPin.lng}`
          : `https://www.google.com/maps/search/?api=1&query=${selectedPin.lat},${selectedPin.lng}`,
        'Waze': `https://waze.com/ul?ll=${selectedPin.lat},${selectedPin.lng}&navigate=yes`,
        'Uber': `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${selectedPin.lat}&dropoff[longitude]=${selectedPin.lng}`
      };
      
      if (urls[choice]) {
        window.open(urls[choice], '_blank');
      }
    }
    
    setSelectedPin(null);
  }, [selectedPin, userLocation]);

  // Handle overlay actions
  const handleOverlayAction = useCallback(async (overlay, action) => {
    if (action === 'earn_more') {
      navigate('/help/available-treatment');
    } else if (action === 'sign_in') {
      navigate('/account/signin');
    } else if (action === 'discover' && overlay.centre_id) {
      setSelectedPin(serverState.pins.find(p => p.id === overlay.centre_id));
    }
  }, [navigate, serverState.pins]);

  // Get random tip
  const getRandomTip = () => {
    const tips = [
      "Did you know? It's your right to be taken care of at the health center unit you go (Doesn't matter if they told you to go see a doctor at your neighbourhood)",
      "Tip: You can help others by sharing how full the health center is right now",
      "Remember: Every information you share helps the community save time"
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  };

  return (
    <div className="map-page">
      {/* Header */}
      <div className="map-header">
        <Logo size="small" />
        <span className="service-name">Less Time</span>
        <div className="header-actions">
          <AccountButton />
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>
      
      {/* Rewrite section */}
      <div className="rewrite-section">
        <span className="rewrite-label">rewrite (describe again)</span>
        <div className="rewrite-input-wrapper">
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder="Describe symptoms..."
            maxLength={300}
            variant="compact"
          />
          <IconButton
            icon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isRefreshing}
            label="Refresh recommendations"
          />
        </div>
      </div>
      
      {/* Info banner with random tip */}
      <InfoBanner>
        <strong>Did you know?</strong> {getRandomTip()}
      </InfoBanner>
      
      {/* Map */}
      <HealthMap
        pins={serverState.pins}
        highlights={serverState.highlights}
        userLocation={userLocation}
        onPinClick={handlePinClick}
        selectedPin={selectedPin}
      />
      
      {/* Pin overlay bubble */}
      {selectedPin && (
        <Overlay
          pin={selectedPin}
          onClose={() => setSelectedPin(null)}
          onDiscover={handleDiscover}
          onMoreInfo={handleMoreInfo}
          onGoToCentre={handleGoToCentre}
          canDiscover={serverState.entitlements.some(
            e => e.cta === 'discover' && e.centre_id === selectedPin.id
          )}
        />
      )}
      
      {/* Server-driven overlays */}
      {serverState.overlays.map((overlay, index) => (
        <Overlay
          key={index}
          {...overlay}
          onAction={(action) => handleOverlayAction(overlay, action)}
        />
      ))}
      
      {/* Tutorial */}
      {serverState.tutorial?.map && (
        <Tutorial 
          steps={serverState.tutorial.map}
          onComplete={() => {
            // Tutorial completion handled by server
          }}
        />
      )}
      
      {/* Location permission modal */}
      {showLocationModal && (
        <LocationPermissionModal
          onResponse={handleLocationResponse}
        />
      )}
    </div>
  );
};

export default MapPage;