import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { supabaseClient } from '@/lib/supabaseClient';
import { sessionSync } from '@/lib/sessionSync';

// Session timeout values (in milliseconds)
const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before timeout
const SESSION_LIFETIME = 8 * 60 * 60 * 1000; // 8 hours

interface SessionContextType {
  isIdle: boolean;
  remainingTime: number;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isIdle, setIsIdle] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [warningTimeoutId, setWarningTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(IDLE_TIMEOUT);
  
  const router = useRouter();
  const { toast } = useToast();

  // Calculate remaining time until session expires
  const getRemainingTime = useCallback(() => {
    if (!sessionStart) return IDLE_TIMEOUT;
    
    const elapsed = Date.now() - sessionStart;
    return Math.max(0, SESSION_LIFETIME - elapsed);
  }, [sessionStart]);

  // Handle user activity
  const handleActivity = useCallback((fromSync = false) => {
    setLastActivity(Date.now());
    setIsIdle(false);
    
    // Clear any existing timeouts
    if (timeoutId) clearTimeout(timeoutId);
    if (warningTimeoutId) clearTimeout(warningTimeoutId);
    
    // Set new timeout for idle detection
    const newTimeoutId = setTimeout(() => {
      setIsIdle(true);
      // Show warning before actual timeout
      const warningId = setTimeout(() => {
        // Force logout after warning period
        handleLogout();
      }, WARNING_TIME);
      setWarningTimeoutId(warningId);
    }, IDLE_TIMEOUT - WARNING_TIME);
    
    setTimeoutId(newTimeoutId);
    
    // Sync activity across tabs (if not from sync itself to prevent loops)
    if (!fromSync) {
      sessionSync.broadcastActivity();
    }
  }, [timeoutId, warningTimeoutId]);

  // Handle user logout
  const handleLogout = useCallback(async (fromSync = false) => {
    try {
      await supabaseClient.auth.signOut();
      
      // Only redirect and show toast if not from sync (to prevent multiple toasts)
      if (!fromSync) {
        router.push('/signin');
        toast({
          title: 'Session Expired',
          description: 'You have been logged out due to inactivity.',
          variant: 'destructive',
        });
        // Notify other tabs
        sessionSync.broadcastLogout();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [router, toast]);

  // Initialize session start time and set up listeners
  useEffect(() => {
    setSessionStart(Date.now());
    
    // Set up activity listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handleUserActivity = () => handleActivity();
    
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Set up session expiration check
    const checkSessionExpiry = () => {
      const remaining = getRemainingTime();
      setRemainingTime(remaining);
      
      if (remaining <= 0) {
        handleLogout();
      }
    };
    
    const intervalId = setInterval(checkSessionExpiry, 1000);
    
    // Set up cross-tab sync listeners
    const cleanupActivity = sessionSync.on('activity', () => handleActivity(true));
    const cleanupLogout = sessionSync.on('logout', () => handleLogout(true));
    const cleanupExtend = sessionSync.on('extend', () => resetSession(true));
    
    // Initial activity to start the timer
    handleActivity();
    
    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      clearInterval(intervalId);
      cleanupActivity();
      cleanupLogout();
      cleanupExtend();
    };
  }, [handleActivity, getRemainingTime, handleLogout, timeoutId, warningTimeoutId]);

  // Reset session timer
  const resetSession = useCallback((fromSync = false) => {
    setLastActivity(Date.now());
    setSessionStart(Date.now());
    setIsIdle(false);
    
    if (timeoutId) clearTimeout(timeoutId);
    if (warningTimeoutId) clearTimeout(warningTimeoutId);
    
    handleActivity(fromSync);
    
    // Notify other tabs if this was a user action
    if (!fromSync) {
      sessionSync.broadcastExtend();
    }
  }, [handleActivity, timeoutId, warningTimeoutId]);

  return (
    <SessionContext.Provider value={{ isIdle, remainingTime, resetSession }}>
      {children}
      <SessionTimeoutModal isOpen={isIdle} onExtendSession={resetSession} />
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

// Session Timeout Modal Component
const SessionTimeoutModal: React.FC<{ isOpen: boolean; onExtendSession: () => void }> = ({
  isOpen,
  onExtendSession,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Session Timeout Warning</h2>
        <p className="mb-6">Your session is about to expire due to inactivity. Would you like to continue?</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onExtendSession}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none"
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
};
