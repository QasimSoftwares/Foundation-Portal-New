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
    await signOut();
    // The signOut function from useAuth will handle session clearing and redirection.
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
