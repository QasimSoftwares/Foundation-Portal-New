import { LucideIcon } from 'lucide-react';

export interface NavLink {
  href: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

export interface UserRoles {
  isAdmin: boolean;
  isDonor: boolean;
  isMember: boolean;
  isVolunteer: boolean;
  isViewer: boolean;
}
