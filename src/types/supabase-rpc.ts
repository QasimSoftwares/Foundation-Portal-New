import { SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc<T = any>(
      fn: string,
      params?: Record<string, any>,
      options?: {
        head?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
      }
    ): {
      data: T | null;
      error: any;
      status: number;
      statusText: string;
    };
  }
}

// Define the return types for our RPC functions
declare global {
  type UserRoles = Record<string, boolean>;

  type PermissionResult = boolean;
  
  // Extend the global Express namespace for our custom request types
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: UserRoles;
        isAdmin: boolean;
      };
    }
  }
}

export {};
