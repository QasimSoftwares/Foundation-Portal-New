import type { AppProps } from 'next/app';
import { useCSRFInterceptor } from '@/lib/http/csrf-interceptor';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { logger } from '@/lib/utils/logger';

// Global styles
import '../app/globals.css';

// Initialize CSRF protection for the entire app
export default function App({ Component, pageProps }: AppProps) {
  // Initialize CSRF interceptor
  useCSRFInterceptor();
  
  // Log page views and handle CSRF token refresh
  const router = useRouter();
  
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      logger.info(`[App] Page view url=${url}`);
      
      // Refresh CSRF token on route change if needed
      // The interceptor will handle adding it to subsequent requests
    };

    // Log the first pageview
    logger.info(`[App] Initial page load path=${window.location.pathname}`);

    // Subscribe to route changes
    router.events.on('routeChangeComplete', handleRouteChange);

    // Cleanup
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <Component {...pageProps} />
  );
}
