import { NextRequest } from 'next/server';

/**
 * Get the client's IP address from the request
 * @param req The Next.js request object
 * @returns The client's IP address or 'unknown' if not available
 */
export function getClientIP(req: NextRequest): string {
  // Try to get the IP from x-forwarded-for header (common in proxies)
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // Try to get the IP from x-real-ip header (set by some proxies)
  const xRealIP = req.headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP.trim();
  }

  // Fall back to the connection remote address
  // @ts-ignore - req.connection is not in the type definition but exists in Node.js
  const connectionRemoteAddress = req.connection?.remoteAddress;
  if (connectionRemoteAddress) {
    return connectionRemoteAddress;
  }

  // Fall back to the socket remote address
  // @ts-ignore - req.socket is not in the type definition but exists in Node.js
  const socketRemoteAddress = req.socket?.remoteAddress;
  if (socketRemoteAddress) {
    return socketRemoteAddress;
  }

  // Fall back to the request IP (set by Next.js in some environments)
  // @ts-ignore - req.ip is not in the type definition but exists in some environments
  if (req.ip) {
    // @ts-ignore
    return req.ip;
  }

  return 'unknown';
}

/**
 * Check if an IP address is in a given CIDR range
 * @param ip The IP address to check
 * @param cidr The CIDR range to check against (e.g., '192.168.1.0/24')
 * @returns True if the IP is in the CIDR range, false otherwise
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits = '32'] = cidr.split('/');
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    const mask = ~(0xffffffff >>> parseInt(bits, 10));
    
    // Convert IP and range to 32-bit integers
    const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const rangeInt = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
    
    return (ipInt & mask) === (rangeInt & mask);
  } catch (error) {
    console.error('Error checking IP in CIDR:', error);
    return false;
  }
}

/**
 * Check if an IP address is in a list of IPs or CIDR ranges
 * @param ip The IP address to check
 * @param ipList Array of IPs or CIDR ranges
 * @returns True if the IP is in the list, false otherwise
 */
export function isIPInList(ip: string, ipList: string[]): boolean {
  return ipList.some((ipOrCidr: string) => {
    if (ipOrCidr.includes('/')) {
      return isIPInCIDR(ip, ipOrCidr);
    }
    return ip === ipOrCidr;
  });
}
