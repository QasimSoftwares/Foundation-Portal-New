import { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/AuthLayout';

export const metadata: Metadata = {
  title: 'FPN - Authentication',
  description: 'Authentication pages for FPN',
};

export default function AuthPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLayout 
      title="Welcome to FPN"
      subtitle="Sign in to your account"
      footerText={
        <>
          Don't have an account?{' '}
          <a href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
            Sign up
          </a>
        </>
      }
    >
      {children}
    </AuthLayout>
  );
}
