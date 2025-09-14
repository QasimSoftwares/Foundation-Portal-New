import { PageLayout } from '@/components/layout/PageLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageLayout>
      {children}
    </PageLayout>
  );
}
