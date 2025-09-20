import { Home, User, HeartHandshake, Users, Eye } from 'lucide-react';
import { ROLE_DASHBOARDS } from '@/config/routes';
import { NavLink, UserRoles } from '@/types/navigation';

const allLinks: NavLink[] = [
  {
    href: ROLE_DASHBOARDS.viewer,
    icon: <Home className="h-5 w-5" />,
    label: 'Dashboard',
  },
  {
    href: '/profile',
    icon: <User className="h-5 w-5" />,
    label: 'My Profile',
  },
  {
    href: ROLE_DASHBOARDS.member,
    icon: <Users className="h-5 w-5" />,
    label: 'Member Area',
  },
  {
    href: ROLE_DASHBOARDS.volunteer,
    icon: <Users className="h-5 w-5" />,
    label: 'Volunteer Portal',
  },
  {
    href: ROLE_DASHBOARDS.donor,
    icon: <HeartHandshake className="h-5 w-5" />,
    label: 'Donor Portal',
  },
  {
    href: '/learn-more',
    icon: <Eye className="h-5 w-5" />,
    label: 'Learn More',
  },
];

export function getNavLinks(roles: UserRoles): NavLink[] {
  const links: NavLink[] = [];

  if (roles.isAdmin) {
    // Admin sidebar is handled separately
    return [];
  }

  // Add dashboard link based on the active role
  const activeRole = roles.isDonor ? 'donor' : roles.isVolunteer ? 'volunteer' : roles.isMember ? 'member' : 'viewer';
  links.push({ ...allLinks[0], href: ROLE_DASHBOARDS[activeRole] });
  links.push(allLinks[1]); // My Profile

  if (roles.isMember) {
    links.push(allLinks[2]);
  }
  if (roles.isVolunteer) {
    links.push(allLinks[3]);
  }
  if (roles.isDonor) {
    links.push(allLinks[4]);
  }
  if (roles.isViewer) {
    links.push(allLinks[5]);
  }

  // Remove duplicates that might be added if a user has multiple roles
  return links.filter((link, index, self) =>
    index === self.findIndex((l) => l.href === link.href)
  );
}
