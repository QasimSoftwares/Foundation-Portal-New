import { Router, Request, Response, NextFunction } from 'express';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  expressWithAuth, 
  expressRequireAdmin, 
  expressRequirePermission 
} from '@/lib/supabase/expressMiddleware';

// Type declarations moved to roleService.ts

const router: Router = Router();

// Example protected route that requires authentication
router.get('/profile', expressWithAuth(), async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    
    res.json(profile);
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
});

// Admin-only route example
router.get('/admin/stats', 
  expressRequireAdmin,
  async (req: Request, res: Response) => {
    try {
      // Example admin-only statistics
      const [
        { count: userCount },
        { count: donorCount },
        { count: volunteerCount },
      ] = await Promise.all([
        supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseClient.from('user_roles').select('*', { count: 'exact', head: true }).eq('is_donor', true),
        supabaseClient.from('user_roles').select('*', { count: 'exact', head: true }).eq('is_volunteer', true),
      ]) as any[];

      res.json({
        totalUsers: userCount || 0,
        totalDonors: donorCount || 0,
        totalVolunteers: volunteerCount || 0,
      });
    } catch (error: any) {
      console.error('Admin stats error:', error);
      res.status(500).json({ error: 'Failed to fetch admin statistics' });
    }
  }
);

// Example admin user management
router.get('/admin/users', 
  expressRequireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*');

      if (error) throw error;
      
      res.json(users || []);
    } catch (error: any) {
      console.error('Admin users fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch admin users' });
    }
  }
);

// Example protected route for members
router.get('/members/dashboard', 
  expressRequirePermission('member'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: memberData, error } = await supabaseClient
        .from('members')
        .select('*')
        .eq('user_id', req.user.id)
        .single();

      if (error) throw error;
      
      res.json({
        message: 'Welcome to the member dashboard',
        memberData,
      });
    } catch (error: any) {
      console.error('Member dashboard error:', error);
      res.status(500).json({ error: 'Failed to fetch member data' });
    }
  }
);

// Example protected route for donors
router.get('/donations', 
  expressRequirePermission('donor'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: donations, error } = await supabaseClient
        .from('donations')
        .select('*')
        .eq('donor_id', req.user.id);

      if (error) throw error;
      
      res.json(donations || []);
    } catch (error: any) {
      console.error('Donations fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch donations' });
    }
  }
);

export default router;
