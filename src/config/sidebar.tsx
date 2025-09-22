import { Home, Heart, Clock, Users, Calendar } from 'lucide-react';

export type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export const sidebarConfig: Record<string, NavLink[]> = {
  donor: [
    { href: '/donor/dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
    { href: '/donor/donations', label: 'My Donations', icon: <Heart className="h-4 w-4" /> },
    { href: '/donor/projects', label: 'Projects', icon: <Calendar className="h-4 w-4" /> },
  ],
  volunteer: [
    { href: '/volunteer/dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
    { href: '/volunteer/hours', label: 'My Hours', icon: <Clock className="h-4 w-4" /> },
    { href: '/volunteer/projects', label: 'Project Details', icon: <Calendar className="h-4 w-4" /> },
  ],
  member: [
    { href: '/member/dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
    { href: '/member/community', label: 'Community', icon: <Users className="h-4 w-4" /> },
    { href: '/member/events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
  ],
};
