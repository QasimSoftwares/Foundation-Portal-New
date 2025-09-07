/**
 * Utility functions for handling IP addresses
 */

export function getClientIp(forwardedFor: string | null): string {
  if (!forwardedFor) {
    return '127.0.0.1'; // Default to localhost if no IP is found
  }
  
  // Handle comma-separated list of IPs (common with proxies)
  const ips = forwardedFor.split(',').map(ip => ip.trim());
  return ips[0] || '127.0.0.1';
}

// Add any additional IP-related utilities here
