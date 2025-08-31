import { supabaseClient } from '@/lib/supabaseClient';
import { Request } from 'express';

type UserRole = {
  is_admin: boolean;
  is_volunteer: boolean;
  is_donor: boolean;
  is_member: boolean;
  is_viewer: boolean;
};

/**
 * Get all roles and permissions for the current user
 * @param req Express request object
 * @returns User roles and permissions
 */
export const getMyRoles = async (req: Request) => {
  try {
    const { data, error } = await supabaseClient.rpc('my_roles');
    
    if (error) {
      console.error('Error getting user roles:', error);
      throw error;
    }
    
    return data || {};
  } catch (error) {
    console.error('Error in getMyRoles:', error);
    throw new Error('Failed to fetch user roles');
  }
};

/**
 * Check if the current user has a specific permission
 * @param req Express request object
 * @param action The action to check permission for
 * @returns Boolean indicating if the user has the permission
 */
export const canI = async (req: Request, action: string): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient.rpc('can_i', { p_action: action });
    
    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error in canI:', error);
    return false;
  }
};

/**
 * Check if a user has a specific permission
 * @param userId The user ID to check
 * @param action The action to check permission for
 * @returns Boolean indicating if the user has the permission
 */
export const hasPermission = async (userId: string, action: string): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient.rpc('has_permission', {
      p_user_id: userId,
      p_action: action
    });
    
    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error in hasPermission:', error);
    return false;
  }
};

/**
 * Check if the current user is an admin
 * @param req Express request object
 * @returns Boolean indicating if the user is an admin
 */
export const isAdmin = async (req: Request): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient.rpc('is_admin');
    
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error in isAdmin:', error);
    return false;
  }
};

/**
 * Middleware to check if user has a specific permission
 * @param action The action to check permission for
 * @returns Express middleware function
 */
export const requirePermission = (action: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const hasPerm = await canI(req, action);
      
      if (!hasPerm) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You don't have permission to ${action}`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error in requirePermission middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check if user is an admin
 * @returns Express middleware function
 */
export const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const admin = await isAdmin(req);
    
    if (!admin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error in requireAdmin middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
