import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface AuthLayoutProps {
  children?: ReactNode;
  title: string;
  subtitle?: string | ReactNode;
  footerText?: string | ReactNode;
  footerLink?: {
    text: string;
    href: string;
  };
  className?: string;
}

export function AuthLayout({
  children = null,
  title,
  subtitle,
  footerText,
  footerLink,
  className,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={cn("mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10", className)}>
          {children}
        </div>
        
        {(footerText || footerLink) && (
          <div className="mt-6 text-center text-sm">
            {footerText}
            {footerLink && (
              <Link 
                href={footerLink.href}
                className="font-medium text-indigo-600 hover:text-indigo-500 ml-1"
              >
                {footerLink.text}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthLayout;
