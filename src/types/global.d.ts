// Type definitions for custom modules
declare module '../lib/security/ip' {
  export function getClientIP(req: NextRequest): string;
  export function isIPInCIDR(ip: string, cidr: string): boolean;
  export function isIPInList(ip: string, ipList: string[]): boolean;
}
