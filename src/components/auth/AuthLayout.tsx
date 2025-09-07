import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Head from 'next/head';

export interface AuthLayoutProps {
  children?: ReactNode;
  title?: string;
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
    <>
      <Head>
        <style>{`
          .auth-background {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #f8fafc;
            background-image: url('/auth-pattern.svg');
            background-size: cover;
            background-position: center;
            z-index: -1;
          }
        `}</style>
      </Head>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="auth-background"></div>
        <div className="max-w-md w-full space-y-8 z-10">
          {(title || subtitle) && (
            <div className="text-center">
              {title && (
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className={`mt-2 text-sm text-gray-700 ${!title ? 'mt-6' : ''}`}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          
          <div className={cn("mt-8 bg-white/90 backdrop-blur-sm py-8 px-4 shadow-xl rounded-xl sm:px-10 border border-gray-100", className)}>
            {children}
          </div>
          
          {(footerText || footerLink) && (
            <div className="mt-6 text-center text-sm text-gray-700">
              {footerText}
              {footerLink && (
                <Link 
                  href={footerLink.href}
                  className="font-medium text-brand-blue hover:text-blue-700 ml-1 transition-colors duration-200"
                >
                  {footerLink.text}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AuthLayout;
