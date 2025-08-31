import { Router, Request, Response } from 'express';

/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please use the new App Router routes in the src/app/api directory.
 * 
 * New routes:
 * - /api/admin/dashboard
 * - /api/volunteer/dashboard
 * - /api/donor/dashboard
 * - /api/member/dashboard
 */
const router: Router = Router();

// Admin dashboard - only accessible by admin (deprecated)
router.get('/admin/dashboard', (req: Request, res: Response) => {
  res.status(410).json({
    error: 'Deprecated',
    message: 'This endpoint is deprecated. Please use /api/admin/dashboard instead.',
    docs: 'https://docs.your-app.com/api/migration-guide'
  });
});

// Volunteer dashboard - accessible by volunteers and above (deprecated)
router.get('/volunteer/dashboard', (req: Request, res: Response) => {
  res.status(410).json({
    error: 'Deprecated',
    message: 'This endpoint is deprecated. Please use /api/volunteer/dashboard instead.',
    docs: 'https://docs.your-app.com/api/migration-guide'
  });
});

// Donor dashboard - accessible by donors and above (deprecated)
router.get('/donor/dashboard', (req: Request, res: Response) => {
  res.status(410).json({
    error: 'Deprecated',
    message: 'This endpoint is deprecated. Please use /api/donor/dashboard instead.',
    docs: 'https://docs.your-app.com/api/migration-guide'
  });
});

// Member dashboard - accessible by members and above (deprecated)
router.get('/member/dashboard', (req: Request, res: Response) => {
  res.status(410).json({
    error: 'Deprecated',
    message: 'This endpoint is deprecated. Please use /api/member/dashboard instead.',
    docs: 'https://docs.your-app.com/api/migration-guide'
  });
});

// Reports endpoint (deprecated)
router.get('/reports', (req: Request, res: Response) => {
  res.status(410).json({
    error: 'Deprecated',
    message: 'This endpoint is deprecated. Please use the new API endpoints.',
    docs: 'https://docs.your-app.com/api/migration-guide'
  });
});

export default router;
