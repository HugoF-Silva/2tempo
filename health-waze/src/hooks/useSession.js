import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export const useSession = () => {
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const profile = await apiClient.getProfile();
      if (profile && profile.username) {
        setSession(profile);
        setIsAuthenticated(true);
      }
    } catch (error) {
      // Not authenticated - this is normal for anonymous users
      setSession({ anonymous: true });
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (credentials) => {
    try {
      const response = await apiClient.signIn(credentials);
      if (response.success) {
        await checkSession();
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.signOut();
      setSession({ anonymous: true });
      setIsAuthenticated(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const signup = useCallback(async (userData) => {
    try {
      const response = await apiClient.signUp(userData);
      if (response.success) {
        // Don't auto-login after signup - user needs to confirm email
        return { success: true, message: response.message };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  return {
    session,
    isAuthenticated,
    isLoading,
    login,
    logout,
    signup,
    checkSession
  };
};