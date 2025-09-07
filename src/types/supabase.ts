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
      sessions: {
        Row: {
          id: string;
          user_id: string;
          ip: string | null;
          user_agent: string | null;
          device_type: string;
          device_os: string;
          device_browser: string;
          is_mobile: boolean;
          is_tablet: boolean;
          is_desktop: boolean;
          is_bot: boolean;
          last_active_at: string;
          created_at: string;
          updated_at: string;
          revoked_at: string | null;
          revoked_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          ip?: string | null;
          user_agent?: string | null;
          device_type?: string;
          device_os?: string;
          device_browser?: string;
          is_mobile?: boolean;
          is_tablet?: boolean;
          is_desktop?: boolean;
          is_bot?: boolean;
          last_active_at?: string;
          created_at?: string;
          updated_at?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          ip?: string | null;
          user_agent?: string | null;
          device_type?: string;
          device_os?: string;
          device_browser?: string;
          is_mobile?: boolean;
          is_tablet?: boolean;
          is_desktop?: boolean;
          is_bot?: boolean;
          last_active_at?: string;
          updated_at?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
        };
      };
      user_devices: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          device_name: string | null;
          device_type: string | null;
          os: string | null;
          browser: string | null;
          is_mobile: boolean;
          is_tablet: boolean;
          is_desktop: boolean;
          is_bot: boolean;
          last_used_at: string | null;
          first_seen_at: string | null;
          trusted: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          device_name?: string | null;
          device_type?: string | null;
          os?: string | null;
          browser?: string | null;
          is_mobile?: boolean;
          is_tablet?: boolean;
          is_desktop?: boolean;
          is_bot?: boolean;
          last_used_at?: string | null;
          first_seen_at?: string | null;
          trusted?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string;
          device_name?: string | null;
          device_type?: string | null;
          os?: string | null;
          browser?: string | null;
          is_mobile?: boolean;
          is_tablet?: boolean;
          is_desktop?: boolean;
          is_bot?: boolean;
          last_used_at?: string | null;
          first_seen_at?: string | null;
          trusted?: boolean;
        };
      };
      refresh_tokens: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          token: string;
          expires_at: string;
          created_at: string;
          used_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          device_info: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          token: string;
          expires_at: string;
          created_at?: string;
          used_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          device_info?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          token?: string;
          expires_at?: string;
          used_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          device_info?: Json | null;
        };
      };
      security_events: {
        Row: {
          id: string;
          event_type: string;
          user_id: string | null;
          session_id: string | null;
          ip: string | null;
          metadata: Json;
          severity: 'low' | 'medium' | 'high';
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string | null;
          session_id?: string | null;
          ip?: string | null;
          metadata?: Json;
          severity?: 'low' | 'medium' | 'high';
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          user_id?: string | null;
          session_id?: string | null;
          ip?: string | null;
          metadata?: Json;
          severity?: 'low' | 'medium' | 'high';
        };
      };
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
