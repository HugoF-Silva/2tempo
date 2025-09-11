import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import ReadStatusPage from './pages/ReadStatusPage';
import ReadWriteStatusPage from './pages/ReadWriteStatusPage';
import HelpPages from './pages/HelpPages';
import HelpByGrowingCommunity from './pages/HelpByGrowingCommunity';
import AccountPages from './pages/AccountPages';
import { apiClient } from './services/apiClient';
import { useSession } from './hooks/useSession';
import { useGeolocation } from './hooks/useGeolocation';
import { AppContext } from './context/AppContext';
import './styles/global.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isAuthenticated, login, logout } = useSession();
  const { userLocation, requestLocation } = useGeolocation();
  const didBootstrapRef = useRef(false);

  // Server-driven state
  const [serverState, setServerState] = useState({
    schema: '1',
    balance: 0,
    shows: 'home',
    tutorial: null,
    overlays: [],
    entitlements: [],
    pins: [],
    highlights: [],
    pages_after: null
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [description, setDescription] = useState('');

  // Bootstrap on first load
  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    (async () => {
      try {
        const response = await apiClient.bootstrap();
        setServerState(prev => ({ ...prev, ...response }));

        // Only let /bootstrap drive navigation when we’re on the entry routes.
        const here = location.pathname || '/';
        const isEntry = here === '/' || here === '/home';
        const target = `/${response.shows || 'home'}`;
        if (isEntry && target !== here) {
          navigate(target, { replace: true });
        }
      } catch (error) {
        console.error('Bootstrap failed:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []); // intentionally empty deps (run once)

  // Execute CTA with server token
  const executeCTA = useCallback(async (ctaId, token, payload = {}) => {
    try {
      setIsLoading(true);
      const response = await apiClient.executeCTA(ctaId, token, payload);
      
      // Update balance from server response
      if (response.balance !== undefined) {
        setServerState(prev => ({ ...prev, balance: response.balance }));
      }
      
      return response;
    } catch (error) {
      console.error('CTA execution failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Navigate to map with server flow
  const navigateToMap = useCallback(async (withDescription) => {
    try {
      setIsLoading(true);
     const loc = await requestLocation(); // <-- assume hook returns {lat,lng} or null
     const locationToUse = loc || userLocation || null;

     const flowData = await apiClient.getMapFlow({
       location: locationToUse,
        symptoms: withDescription ? description : undefined
      });
      
      setServerState(prev => ({
        ...prev,
        ...flowData
      }));
      
      navigate('/map');
    } catch (error) {
      console.error('Map flow failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [description, userLocation, requestLocation, navigate]);

  // Open centre with server decision
  const openCentre = useCallback(async (centreId) => {
    try {
      setIsLoading(true);
      const response = await apiClient.openCentre(centreId, userLocation);
      
      setServerState(prev => ({
        ...prev,
        ...response
      }));
      
      // Navigate based on server's decision
      if (response.shows === 'X') {
        navigate(`/centre/${centreId}/read`);
      } else if (response.shows === 'Y') {
        navigate(`/centre/${centreId}/write`);
      }
      
      return response;
    } catch (error) {
      console.error('Open centre failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, navigate]);

  // Check for nudges based on dwell time
  const checkNudges = useCallback(async (page, dwellTime, recentActions = []) => {
    try {
      const nudges = await apiClient.getNudges({
        page,
        dwell_sec: dwellTime,
        recent_actions: recentActions
      });
      
      if (nudges.overlays) {
        setServerState(prev => ({
          ...prev,
          overlays: nudges.overlays
        }));
      }
    } catch (error) {
      console.error('Nudges check failed:', error);
    }
  }, []);

  const contextValue = {
    // State
    serverState,
    isLoading,
    description,
    userLocation,
    session,
    isAuthenticated,
    
    // Actions
    setDescription,
    navigateToMap,
    openCentre,
    executeCTA,
    checkNudges,
    login,
    logout,
    
    // Server state updates
    updateServerState: (updates) => setServerState(prev => ({ ...prev, ...updates }))
  };

  if (isLoading && !serverState.schema) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/centre/:id/read" element={<ReadStatusPage />} />
        <Route path="/centre/:id/write" element={<ReadWriteStatusPage />} />
        <Route path="/help/*" element={<HelpPages />} />
        <Route path="/grow" element={<HelpByGrowingCommunity />} />
        <Route path="/account/*" element={<AccountPages />} />
      </Routes>
    </AppContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;