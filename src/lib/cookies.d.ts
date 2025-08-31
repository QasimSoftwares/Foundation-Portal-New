/**
 * Type declarations for cookies utility
 */

declare module '@/lib/cookies' {
  /**
   * Get a cookie value by name
   * @param name The name of the cookie to get
   * @returns The cookie value or undefined if not found
   */
  export function getCookie(name: string): string | undefined;

  /**
   * Set a cookie
   * @param name The name of the cookie
   * @param value The value to set
   * @param options Cookie options
   */
  export function setCookie(
    name: string,
    value: string,
    options?: {
      days?: number;
      path?: string;
      domain?: string;
      secure?: boolean;
      sameSite?: 'Lax' | 'Strict' | 'None';
      httpOnly?: boolean;
    }
  ): void;

  /**
   * Delete a cookie
   * @param name The name of the cookie to delete
   * @param path The path of the cookie
   * @param domain The domain of the cookie
   */
  export function deleteCookie(name: string, path?: string, domain?: string): void;
}
