import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/providers/toast-provider';
import { CSRFProvider } from '@/providers/CSRFProvider';
import RoleHydrator from '@/components/roles/RoleHydrator';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FPN - Food Poverty Network',
  description: 'Food Poverty Network - Fighting hunger together',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <CSRFProvider>
          <AuthProvider>
            <RoleHydrator>
              <ToastProvider>
                {children}
              </ToastProvider>
            </RoleHydrator>
          </AuthProvider>
        </CSRFProvider>
      </body>
    </html>
  );
}
