import { PageLayout } from '@/components/layout/PageLayout';

export default function ProfileLayout({ 
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
