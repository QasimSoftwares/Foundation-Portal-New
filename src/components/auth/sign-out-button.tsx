'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

interface SignOutButtonProps extends Omit<ButtonProps, 'onClick'> {
  children?: ReactNode;
}

export function SignOutButton({ 
  className, 
  children = 'Sign Out',
  variant = 'outline',
  ...props 
}: SignOutButtonProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      // Clear role-related storage before signing out
      if (typeof window !== 'undefined') {
        localStorage.removeItem('active-role');
        sessionStorage.removeItem('pendingRole');
      }
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  return (
    <Button 
      variant={variant}
      className={className}
      onClick={handleSignOut}
      {...props}
    >
      {children}
    </Button>
  );
}
