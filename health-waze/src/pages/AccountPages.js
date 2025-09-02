import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDwellTime } from '../hooks/useDwellTime';
import SignInSignUp from './account/SignInSignUp';
import Profile from './account/Profile';
// import TermsOfUse from './account/TermsOfUse';
// import DataPolicy from './account/DataPolicy';
import Overlay from '../components/Overlay';
import './AccountPages.css';

const AccountPages = () => {
  const navigate = useNavigate();
  const location = useLocation(); // ✅ use the router location, not the global
  const [searchParams] = useSearchParams();
  const { serverState, isAuthenticated, checkNudges } = useApp();
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const referralCode = searchParams.get('ref');

  // Track idle time for sign-in nudge
  const dwellTimeThresholds = [
    { id: 'idle_3min', seconds: 180, type: 'idle' }
  ];

  const handleDwellThreshold = async ({ id }) => {
    if (id === 'idle_3min' && !isAuthenticated && serverState.balance > 0) {
      const nudges = await checkNudges('account', 180, ['no_spend']);
      if (nudges?.overlays?.length > 0) {
        setShowIdleWarning(true);
      }
    }
  };

  const { resetActivity } = useDwellTime(
    !isAuthenticated ? handleDwellThreshold : null,
    !isAuthenticated ? dwellTimeThresholds : []
  );

  useEffect(() => {
    // If already authenticated, redirect to profile
    if (isAuthenticated && location.pathname === '/account/signin') {
      navigate('/account/profile');
    }
  }, [isAuthenticated, location.pathname, navigate]); // ✅ include pathname (or `location`) in deps

  const handleOverlayAction = (action) => {
    if (action === 'sign_in') {
      resetActivity();
      // Stay on sign in page
    } else if (action === 'close') {
      setShowIdleWarning(false);
    }
  };

  return (
    <div className="account-pages">
      <Routes>
        <Route
          path="signin"
          element={<SignInSignUp referralCode={referralCode} />}
        />
        <Route
          path="profile"
          element={<Profile />}
        />
        <Route
          path="terms"
          // element={<TermsOfUse />}
        />
        <Route
          path="privacy"
          // element={<DataPolicy />}
        />
      </Routes>

      {/* Idle warning overlay */}
      {showIdleWarning && (
        <Overlay
          type="nudge"
          anchor="sign-in"
          message="If you don't sign in, you will lose Time $aved"
          actions={[
            { id: 'sign_in', label: 'Sign in', variant: 'primary' },
            { id: 'close', label: '×', variant: 'close' }
          ]}
          onAction={handleOverlayAction}
          onClose={() => setShowIdleWarning(false)}
        />
      )}
    </div>
  );
};

export default AccountPages;
