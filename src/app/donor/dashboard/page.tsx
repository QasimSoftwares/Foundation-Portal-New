import { Coins, Heart, Layers3, CalendarClock } from 'lucide-react';
import DonorDashboardClient from '@/components/donor/DonorDashboardClient';
import { PageLayout } from '@/components/layout/PageLayout';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Define a type for the data returned by the recent donations RPC
type DonationRow = {
  date: string;
  donationId: string;
  amount: number;
  category: string;
  project: string;
  status: string;
};

async function getDonorData() {
  // This is the correct way to initialize the client in a Server Component.
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

  // RPC calls do not use .single(). They return their data directly.
  const [{ data: metricsData }, { data: recentDonationsData }, { data: summaryData }, { data: categoriesData }, { data: projectsData }] = await Promise.all([
    supabase.rpc('get_donor_dashboard_metrics'),
    supabase.rpc('get_donor_recent_donations'),
    supabase.rpc('get_donor_donations_summary', { p_category_id: null, p_project_id: null }),
    supabase.rpc('get_donation_categories'),
    supabase.rpc('get_projects'),
  ]);

  // The metrics RPC returns an array with one object, so we access the first element.
  const metrics = [
    {
      title: 'Total Donations',
      value: `PKR ${Number(metricsData?.[0]?.total_donations || 0).toLocaleString()}`,
      icon: <Coins className="h-5 w-5" />,
      accent: 'green' as const,
      subtext: `${metricsData?.[0]?.total_donation_count || 0} donations`,
    },
    {
      title: 'Last Donation',
      value: `PKR ${Number(metricsData?.[0]?.last_donation_amount || 0).toLocaleString()}`,
      icon: <CalendarClock className="h-5 w-5" />,
      accent: 'blue' as const,
      subtext: metricsData?.[0]?.last_donation_date ? `on ${new Date(metricsData[0].last_donation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No recent donations',
    },
    {
      title: 'Active Pledges', // Mock data, as this is not in the RPC yet
      value: '0',
      icon: <Heart className="h-5 w-5" />,
      accent: 'amber' as const,
      subtext: 'View pledges',
    },
    {
      title: 'Programs Supported',
      value: (metricsData?.[0]?.unique_projects_supported || 0).toString(),
      icon: <Layers3 className="h-5 w-5" />,
      accent: 'rose' as const,
      subtext: 'Across all categories',
    },
  ];

  const recentDonations = ((recentDonationsData as DonationRow[]) || []).map((d) => ({ 
    ...d, 
    status: 'Completed' as const 
  }));

  const initialSummary = (summaryData as any[]) || [];
  const initialCategories = (categoriesData as any[]) || [];
  const initialProjects = (projectsData as any[]) || [];

  return { metrics, recentDonations, initialSummary, initialCategories, initialProjects };
}

export default async function DonorDashboardPage() {
  const { metrics, recentDonations, initialSummary, initialCategories, initialProjects } = await getDonorData();

  return (
    <PageLayout>
      <div className="space-y-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Donor Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Your personal contribution overview</p>
        </div>
        <DonorDashboardClient 
          initialMetrics={metrics} 
          initialRecentDonations={recentDonations}
          initialSummary={initialSummary}
          initialCategories={initialCategories}
          initialProjects={initialProjects}
        />
      </div>
    </PageLayout>
  );
}
