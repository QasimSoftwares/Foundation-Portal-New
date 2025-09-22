import { PageLayout } from '@/components/layout/PageLayout';
import DonorDonationsTable from '@/components/donor/DonorDonationsTable';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getDonations() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // no-op in server component
        },
        remove(name: string, options: CookieOptions) {
          // no-op in server component
        },
      },
    }
  );

  const { data, error } = await supabase.rpc('get_my_donations');
  if (error) {
    return { donations: [], error: error.message };
  }
  return { donations: data ?? [] };
}

export default async function DonorDonationsPage() {
  const { donations } = await getDonations();

  return (
    <PageLayout>
      <div className="space-y-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Donations</h1>
          <p className="mt-1 text-sm text-gray-600">View your donations and download receipts</p>
        </div>
        <DonorDonationsTable donations={donations} />
      </div>
    </PageLayout>
  );
}
