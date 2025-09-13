import { SupabaseClient } from '@supabase/supabase-js';

export type UserRoles = {
  is_admin: boolean;
  is_volunteer: boolean;
  is_donor: boolean;
  is_member: boolean;
  is_viewer: boolean;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
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
        };
        Insert: {
          user_id: string;
          is_admin?: boolean;
          is_volunteer?: boolean;
          is_donor?: boolean;
          is_member?: boolean;
          is_viewer?: boolean;
        };
        Update: {
          user_id?: string;
          is_admin?: boolean;
          is_volunteer?: boolean;
          is_donor?: boolean;
          is_member?: boolean;
          is_viewer?: boolean;
        };
      };
    };
    Functions: {
      create_user_profile: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_full_name: string;
        };
        Returns: void;
      };
      update_email_verification: {
        Args: {
          user_id: string;
        };
        Returns: void;
      };
    };
  };
}

declare global {
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