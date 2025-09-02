import { useEffect, useRef, useCallback } from 'react';

export const useDwellTime = (onThreshold, thresholds = []) => {
  const startTime = useRef(Date.now());
  const lastActivity = useRef(Date.now());
  const triggeredThresholds = useRef(new Set());

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  const resetDwellTime = useCallback(() => {
    startTime.current = Date.now();
    lastActivity.current = Date.now();
    triggeredThresholds.current.clear();
  }, []);

  useEffect(() => {
    const checkThresholds = () => {
      const currentTime = Date.now();
      const dwellTime = Math.floor((currentTime - startTime.current) / 1000);
      const idleTime = Math.floor((currentTime - lastActivity.current) / 1000);

      thresholds.forEach(({ seconds, type = 'dwell', id }) => {
        const time = type === 'idle' ? idleTime : dwellTime;
        
        if (time >= seconds && !triggeredThresholds.current.has(id)) {
          triggeredThresholds.current.add(id);
          onThreshold({ id, seconds, type, actualTime: time });
        }
      });
    };

    const interval = setInterval(checkThresholds, 1000);
    
    // Track user activity
    const handleActivity = () => resetActivity();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [thresholds, onThreshold, resetActivity]);

  return {
    resetDwellTime,
    resetActivity,
    getDwellTime: () => Math.floor((Date.now() - startTime.current) / 1000),
    getIdleTime: () => Math.floor((Date.now() - lastActivity.current) / 1000)
  };
};