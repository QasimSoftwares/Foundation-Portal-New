export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface TokenPayload {
  userId: string;
  email: string;
  roles: Record<string, boolean>;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name?: string | null;
          role: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          user_id: string;
          is_admin: boolean;
          is_volunteer: boolean;
          is_donor: boolean;
          is_member: boolean;
          is_viewer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          is_admin?: boolean;
          is_volunteer?: boolean;
          is_donor?: boolean;
          is_member?: boolean;
          is_viewer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          is_admin?: boolean;
          is_volunteer?: boolean;
          is_donor?: boolean;
          is_member?: boolean;
          is_viewer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      refresh_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          created_at: string;
          expires_at: string;
          revoked: boolean;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          created_at?: string;
          expires_at: string;
          revoked?: boolean;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          created_at?: string;
          expires_at?: string;
          revoked?: boolean;
          ip_address?: string | null;
          user_agent?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_role: {
        Args: {
          user_id: string;
        };
        Returns: {
          is_admin: boolean;
          is_volunteer: boolean;
          is_donor: boolean;
          is_member: boolean;
          is_viewer: boolean;
        };
      };
      create_refresh_token: {
        Args: {
          p_user_id: string;
          p_token: string;
          p_expires_in_seconds: number;
          p_ip_address?: string;
          p_user_agent?: string;
        };
        Returns: { id: string };
      };
      validate_refresh_token: {
        Args: { 
          p_token: string; 
          p_user_id?: string 
        };
        Returns: { is_valid: boolean };
      };
      revoke_all_user_refresh_tokens: {
        Args: { p_user_id: string };
        Returns: void;
      };
      cleanup_expired_tokens: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: Record<string, boolean>;
        isAdmin: boolean;
      };
    }
  }
}
