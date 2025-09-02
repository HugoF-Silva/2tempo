import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import Logo from '../../components/Logo';
// import AccountButton from '../../components/AccountButton';
import BalanceDisplay from '../../components/BalanceDisplay';
import PopupMessage from '../../components/PopupMessage';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const { serverState, logout, isAuthenticated } = useApp();
  
  const [profileData, setProfileData] = useState({
    username: '',
    phone: '',
    email: ''
  });
  const [editMode, setEditMode] = useState({
    username: false,
    phone: false,
    email: false,
    password: false
  });
  const [editValues, setEditValues] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/account/signin');
      return;
    }
    loadProfileData();
  }, [isAuthenticated, navigate]);

  const loadProfileData = async () => {
    try {
      const profile = await apiClient.getProfile();
      setProfileData({
        username: profile.username,
        phone: profile.phone || 'Not informed',
        email: profile.email
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleBack = () => {
    navigate('/map');
  };

  const handleEdit = (field) => {
    setEditMode(prev => ({ ...prev, [field]: true }));
    setEditValues(prev => ({ ...prev, [field]: profileData[field] }));
  };

  const handleSave = async (field) => {
    // API call to update field
    try {
      // await apiClient.updateProfile({ [field]: editValues[field] });
      setProfileData(prev => ({ ...prev, [field]: editValues[field] }));
      setEditMode(prev => ({ ...prev, [field]: false }));
      setMessage({
        type: 'success',
        text: `${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`,
        actions: [{ label: 'Ok', action: 'close' }]
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to update. Please try again.',
        actions: [{ label: 'Ok', action: 'close' }]
      });
    }
  };

  const handleCancel = (field) => {
    setEditMode(prev => ({ ...prev, [field]: false }));
    setEditValues(prev => ({ ...prev, [field]: profileData[field] }));
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate('/');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    
    try {
      // await apiClient.deleteAccount({ password: deletePassword });
      setShowDeleteConfirm(false);
      setMessage({
        type: 'info',
        text: 'Your account was deleted. We hope to see you again one day. Take care!',
        actions: [{ label: 'Ok', action: 'navigate_home' }]
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to delete account. Please check your password.',
        actions: [{ label: 'Ok', action: 'close' }]
      });
    }
  };

  const handleMessageAction = (action) => {
    if (action === 'navigate_home') {
      navigate('/');
    }
    setMessage(null);
  };

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <span className="header-spacer"></span>
        <div className="header-actions">
          <span className="account-label">Account</span>
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>

      {/* Profile content */}
      <div className="profile-content">
        <Logo size="medium" />
        
        <p className="profile-subtitle">
          Saving your time, While improving our city :)
        </p>

        {/* Account fields */}
        <div className="account-box">
          {/* Username */}
          <div className="account-field">
            <span className="field-label">Username</span>
            {editMode.username ? (
              <div className="field-edit">
                <input
                  type="text"
                  value={editValues.username || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, username: e.target.value }))}
                  className="field-input"
                />
                <button onClick={() => handleSave('username')} className="save-button">Save</button>
                <button onClick={() => handleCancel('username')} className="cancel-button">Cancel</button>
              </div>
            ) : (
              <div className="field-display">
                <span className="field-value">{profileData.username}</span>
                <button onClick={() => handleEdit('username')} className="change-button">Change</button>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="account-field">
            <span className="field-label">Number</span>
            {editMode.phone ? (
              <div className="field-edit">
                <input
                  type="tel"
                  value={editValues.phone || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, phone: e.target.value }))}
                  className="field-input"
                />
                <button onClick={() => handleSave('phone')} className="save-button">Save</button>
                <button onClick={() => handleCancel('phone')} className="cancel-button">Cancel</button>
              </div>
            ) : (
              <div className="field-display">
                <span className="field-value">{profileData.phone}</span>
                <button onClick={() => handleEdit('phone')} className="change-button">Change</button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="account-field">
            <span className="field-label">Email</span>
            {editMode.email ? (
              <div className="field-edit">
                <input
                  type="email"
                  value={editValues.email || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, email: e.target.value }))}
                  className="field-input"
                />
                <button onClick={() => handleSave('email')} className="save-button">Save</button>
                <button onClick={() => handleCancel('email')} className="cancel-button">Cancel</button>
              </div>
            ) : (
              <div className="field-display">
                <span className="field-value">{profileData.email}</span>
                <button onClick={() => handleEdit('email')} className="change-button">Change</button>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="account-field">
            <span className="field-label">Password</span>
            <button className="change-password-button">Change Password</button>
          </div>
        </div>

        {/* Policy link */}
        <a 
          href="/account/privacy" 
          className="policy-link"
          onClick={(e) => {
            e.preventDefault();
            navigate('/account/privacy');
          }}
        >
          ℹ️ our data policy
        </a>

        {/* Logout button */}
        <button className="logout-button" onClick={handleLogout}>
          Exit
        </button>

        {/* Danger zone */}
        <div className="danger-zone">
          <div className="danger-divider">Danger zone</div>
          <button 
            className="delete-account-button"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete account and all my data related to it
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="dialog-overlay">
          <div className="delete-dialog">
            <button 
              className="dialog-close"
              onClick={() => setShowDeleteConfirm(false)}
            >
              ×
            </button>
            <h3>Are you sure you want to delete your account?</h3>
            <p>Write your password if yes</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Password"
              className="password-input"
            />
            <button
              className="confirm-delete-button"
              onClick={handleDeleteAccount}
              disabled={!deletePassword}
            >
              Ok
            </button>
          </div>
        </div>
      )}

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

export default Profile;