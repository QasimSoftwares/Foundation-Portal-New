'use client';

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';

interface CSRFContextType {
  csrfToken: string | null;
  isLoading: boolean;
  error: Error | null;
  refreshToken: () => Promise<void>;
}

const CSRFContext = createContext<CSRFContextType | undefined>(undefined);

/**
 * CSRF Provider component that provides CSRF token to the application
 * The actual token management is handled by the centralized middleware
 */
export const CSRFProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Refresh the CSRF token by reloading the page
   * The middleware will set a new token in the cookies
   */
  const refreshToken = async () => {
    try {
      setIsLoading(true);
      // The CSRF token is managed by the centralized middleware
      // Trigger a page reload to get a fresh token
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh CSRF token'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initialize CSRF token on mount
    const initCSRF = async () => {
      try {
        // Get the CSRF token from cookies
        const token = getCookie('sb-csrf-token')?.toString() || null;
        setCsrfToken(token);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize CSRF token'));
      } finally {
        setIsLoading(false);
      }
    };

    initCSRF();
  }, []);

  return (
    <CSRFContext.Provider value={{ csrfToken, isLoading, error, refreshToken }}>
      {children}
    </CSRFContext.Provider>
  );
};

export const useCSRFContext = (): CSRFContextType => {
  const context = useContext(CSRFContext);
  if (context === undefined) {
    throw new Error('useCSRFContext must be used within a CSRFProvider');
  }
  return context;
};
