import { Request, Response, NextFunction } from 'express';
import { supabaseClient } from '../lib/supabaseClient';

type Role = 'viewer' | 'volunteer' | 'donor' | 'member' | 'admin' | 'superadmin';

const ROLE_HIERARCHY: Record<Role, number> = {
  'viewer': 1,
  'volunteer': 2,
  'donor': 3,
  'member': 4,
  'admin': 5,
  'superadmin': 6
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      roles: Record<string, boolean>;
      isAdmin: boolean;
    };
  }
}

export class RoleService {
  static async getUserRoles(userId: string): Promise<Role[]> {
    const { data, error } = await supabaseClient
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return ['viewer']; // Default role
    }

    return Object.entries(data)
      .filter(([key, value]) => key.startsWith('is_') && value === true)
      .map(([key]) => key.replace('is_', '') as Role);
  }

  static hasRequiredRole(userRoles: Role[], requiredRole: Role): boolean {
    if (userRoles.includes('superadmin')) return true;
    
    const userMaxLevel = Math.max(...userRoles.map(role => ROLE_HIERARCHY[role] || 0));
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    return userMaxLevel >= requiredLevel;
  }

  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    
    // Superadmin has all permissions
    if (roles.includes('superadmin')) return true;

    // Check specific permissions based on role
    // This can be expanded based on your permission structure
    const rolePermissions: Record<string, string[]> = {
      admin: ['manage_users', 'view_admin_dashboard'],
      member: ['view_member_dashboard'],
      donor: ['make_donations', 'view_donor_portal'],
      volunteer: ['log_hours', 'view_volunteer_portal'],
      viewer: ['view_public_content']
    };

    return roles.some(role => 
      rolePermissions[role]?.includes(permission)
    );
  }
}

export const requireRole = (requiredRole: Role) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = await RoleService.getUserRoles(req.user.id);
    
    if (!RoleService.hasRequiredRole(userRoles, requiredRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredRole,
        userRoles
      });
    }

    next();
  };
};
