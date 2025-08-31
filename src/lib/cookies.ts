/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

/**
 * Set a cookie
 */
export function setCookie(
  name: string, 
  value: string, 
  options: {
    days?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  } = {}
): void {
  if (typeof document === 'undefined') return;

  const {
    days = 7,
    path = '/',
    domain = '',
    secure = window.location.protocol === 'https:',
    sameSite = 'strict'
  } = options;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  let cookieString = `${name}=${encodeURIComponent(value)}`;
  cookieString += `; expires=${expires.toUTCString()}`;
  cookieString += `; path=${path}`;
  
  if (domain) {
    cookieString += `; domain=${domain}`;
  }
  
  if (secure) {
    cookieString += '; secure';
  }
  
  if (sameSite) {
    cookieString += `; samesite=${sameSite}`;
  }

  document.cookie = cookieString;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string, path = '/', domain?: string): void {
  setCookie(name, '', { days: -1, path, domain });
}
