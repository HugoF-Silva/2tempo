import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
// import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import PopupMessage from '../../components/PopupMessage';
import './SignInSignUp.css';

const SignInSignUp = ({ referralCode = null }) => {
  const navigate = useNavigate();
  const { serverState, login, signup } = useApp();
  
  const [mode, setMode] = useState('signup'); // 'signup' or 'signin'
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: ''
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleBack = () => {
    navigate(-1);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSignUpValid = () => {
    return formData.username.length >= 3 &&
           formData.password.length >= 6 &&
           formData.password === formData.confirmPassword &&
           formData.email.includes('@') &&
           termsAccepted;
  };

  const isSignInValid = () => {
    return (formData.username.length >= 3 || formData.email.includes('@')) &&
           formData.password.length >= 6;
  };

  const handleSignUp = async () => {
    if (!isSignUpValid() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await signup({
        username: formData.username,
        password: formData.password,
        email: formData.email,
        referral_code: referralCode
      });

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'A confirmation email was sent to your email.',
          actions: [{ label: 'Ok', action: 'close' }]
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Sign up failed. Please try again.',
          actions: [{ label: 'Ok', action: 'close' }]
        });
      }
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

  const handleSignIn = async () => {
    if (!isSignInValid() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await login({
        username: formData.username || formData.email,
        password: formData.password
      });

      if (result.success) {
        navigate('/map');
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Invalid credentials. Please try again.',
          actions: [{ label: 'Ok', action: 'close' }]
        });
      }
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
    setMessage(null);
  };

  const toggleMode = () => {
    setMode(mode === 'signup' ? 'signin' : 'signup');
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      email: ''
    });
    setTermsAccepted(false);
  };

  return (
    <div className="signin-signup-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <span className="header-spacer"></span>
        <div className="header-actions">
          <span className="account-label">Account</span>
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>

      {/* Form container */}
      <div className="form-container">
        {mode === 'signup' ? (
          <div className="form-panel">
            <h2 className="form-title">Create account</h2>
            
            <input
              type="text"
              className="form-input"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
            />
            
            <input
              type="password"
              className="form-input"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
            />
            
            <input
              type="password"
              className="form-input"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            />
            
            <input
              type="email"
              className="form-input"
              placeholder="Email/Phone"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I accept the{' '}
                <a href="/account/terms" onClick={(e) => {
                  e.preventDefault();
                  navigate('/account/terms');
                }}>terms of use</a> and{' '}
                <a href="/account/privacy" onClick={(e) => {
                  e.preventDefault();
                  navigate('/account/privacy');
                }}>data policy</a>
              </span>
            </label>
            
            <button
              className="submit-button"
              onClick={handleSignUp}
              disabled={!isSignUpValid() || isSubmitting}
            >
              Create
            </button>
            
            <button 
              className="switch-mode-button"
              onClick={toggleMode}
            >
              Sign in with already made account
            </button>
          </div>
        ) : (
          <div className="form-panel">
            <h2 className="form-title">Sign in with already made account</h2>
            
            <input
              type="text"
              className="form-input"
              placeholder="Username/Email/Phone"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
            />
            
            <input
              type="password"
              className="form-input"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
            />
            
            <button
              className="submit-button"
              onClick={handleSignIn}
              disabled={!isSignInValid() || isSubmitting}
            >
              Enter
            </button>
            
            <button 
              className="switch-mode-button switch-mode-button--top"
              onClick={toggleMode}
            >
              Create account
            </button>
          </div>
        )}
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

export default SignInSignUp;