'use client';

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { getCSRFToken } from '@/lib/csrf';

interface CSRFContextType {
  csrfToken: string | null;
  isLoading: boolean;
  error: Error | null;
  refreshToken: () => Promise<void>;
}

const CSRFContext = createContext<CSRFContextType | undefined>(undefined);

export const CSRFProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshToken = async () => {
    try {
      setIsLoading(true);
      // The CSRF token is now managed by the centralized middleware
      // We just need to trigger a page refresh to get a new token
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
    const initCSRF = () => {
      try {
        // Get the CSRF token from the centralized service
        const token = getCSRFToken();
        setCsrfToken(token || null);
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
