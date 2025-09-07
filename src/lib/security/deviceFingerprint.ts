import { headers } from 'next/headers';
import { v5 as uuidv5 } from 'uuid';

/**
 * Generates a consistent device fingerprint based on request headers
 * This is a best-effort approach and can be enhanced based on your needs
 */
export function generateDeviceFingerprint(headers: Headers): string {
  // Get relevant headers for fingerprinting
  const userAgent = headers.get('user-agent') || '';
  const accept = headers.get('accept') || '';
  const acceptLanguage = headers.get('accept-language') || '';
  const acceptEncoding = headers.get('accept-encoding') || '';
  const connection = headers.get('connection') || '';
  const dnt = headers.get('dnt') || '';
  const referer = headers.get('referer') || '';
  const secFetchDest = headers.get('sec-fetch-dest') || '';
  const secFetchMode = headers.get('sec-fetch-mode') || '';
  const secFetchSite = headers.get('sec-fetch-site') || '';
  
  // Create a fingerprint string
  const fingerprintString = [
    userAgent,
    accept,
    acceptLanguage,
    acceptEncoding,
    connection,
    dnt,
    referer,
    secFetchDest,
    secFetchMode,
    secFetchSite,
  ].join('|');
  
  // Generate a deterministic UUID v5 based on the fingerprint string
  // Using a fixed namespace UUID for consistency
  const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'; // Random UUID v4 as namespace
  const deviceId = uuidv5(fingerprintString, NAMESPACE);
  
  return deviceId;
}

/**
 * Gets the device ID from the request headers or generates a new one
 */
export function getOrCreateDeviceId(headers: Headers): string {
  // First, try to get the device ID from the cookie
  const cookieHeader = headers.get('cookie') || '';
  const deviceIdMatch = cookieHeader.match(/deviceId=([^;]+)/);
  
  if (deviceIdMatch && deviceIdMatch[1]) {
    return deviceIdMatch[1];
  }
  
  // If no device ID in cookies, generate a new one
  return generateDeviceFingerprint(headers);
}

/**
 * Gets device information from headers
 */
export interface DeviceInfo {
  type: 'mobile' | 'desktop' | 'tablet' | 'bot' | 'unknown';
  os: string;
  browser: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isBot: boolean;
}

export function getDeviceInfo(headers: Headers): DeviceInfo {
  const userAgent = headers.get('user-agent') || '';
  const result: DeviceInfo = {
    type: 'unknown',
    os: 'unknown',
    browser: 'unknown',
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isBot: false,
  };

  // Check for bots first
  const botRegex = /bot|googlebot|crawler|spider|robot|crawling/i;
  if (botRegex.test(userAgent)) {
    result.type = 'bot';
    result.isBot = true;
    return result;
  }

  // Detect OS
  if (/windows/i.test(userAgent)) {
    result.os = 'Windows';
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    result.os = 'macOS';
  } else if (/linux/i.test(userAgent)) {
    result.os = 'Linux';
  } else if (/android/i.test(userAgent)) {
    result.os = 'Android';
    result.isMobile = true;
    result.type = 'mobile';
  } else if (/ipad/i.test(userAgent)) {
    result.os = 'iOS';
    result.isTablet = true;
    result.type = 'tablet';
  } else if (/iphone/i.test(userAgent)) {
    result.os = 'iOS';
    result.isMobile = true;
    result.type = 'mobile';
  }

  // Detect browser
  if (/edg/i.test(userAgent)) {
    result.browser = 'Edge';
  } else if (/opr\//i.test(userAgent)) {
    result.browser = 'Opera';
  } else if (/chrome|chromium|crios/i.test(userAgent)) {
    result.browser = 'Chrome';
  } else if (/firefox|fxios/i.test(userAgent)) {
    result.browser = 'Firefox';
  } else if (/safari/i.test(userAgent)) {
    result.browser = 'Safari';
  } else if (/trident/i.test(userAgent)) {
    result.browser = 'Internet Explorer';
  }

  // If not mobile or tablet, assume desktop
  if (!result.isMobile && !result.isTablet && !result.isBot) {
    result.isDesktop = true;
    result.type = 'desktop';
  }

  return result;
}

/**
 * Middleware to set device ID cookie if not present
 */
export function withDeviceTracking(handler: Function) {
  return async function (request: Request) {
    const headers = request.headers;
    const deviceId = getOrCreateDeviceId(headers);
    
    // Call the original handler
    const response = await handler(request);
    
    // If this is a NextResponse, we can set the cookie
    if (response instanceof Response) {
      // Clone the response to add the cookie
      const newResponse = new Response(response.body, response);
      
      // Set the device ID cookie (30 days expiration)
      newResponse.headers.append(
        'Set-Cookie',
        `deviceId=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
      );
      
      return newResponse;
    }
    
    return response;
  };
}
