import { PageLayout } from '@/components/layout/PageLayout';

export default function DashboardLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <PageLayout>
      {children}
    </PageLayout>
  );
}
