'use client';

import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';

export function CSRFTokenInput() {
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    // Get CSRF token from cookie
    const token = getCookie('sb-csrf-token') as string;
    if (token) {
      setCsrfToken(token);
    }
  }, []);

  return csrfToken ? (
    <input type="hidden" name="_csrf" value={csrfToken} />
  ) : null;
}
