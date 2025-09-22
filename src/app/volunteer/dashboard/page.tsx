import { PageLayout } from '@/components/layout/PageLayout';
import MetricCard from '@/components/admin/MetricCard';
import { Clock, TrendingUp, Layers3, CalendarCheck } from 'lucide-react';

export default async function VolunteerDashboardPage() {
  // Mock metrics (to be replaced with RPC-backed data later)
  const metrics = [
    {
      title: 'Total Volunteer Hours',
      value: '120',
      icon: <Clock className="h-5 w-5" />,
      accent: 'green' as const,
      subtext: 'All-time hours',
    },
    {
      title: 'Impact Level',
      value: 'High',
      icon: <TrendingUp className="h-5 w-5" />,
      accent: 'blue' as const,
      subtext: 'Based on recent activity',
    },
    {
      title: 'Active Projects',
      value: '3',
      icon: <Layers3 className="h-5 w-5" />,
      accent: 'amber' as const,
      subtext: 'Currently assigned',
    },
    {
      title: 'Events Attended',
      value: '8',
      icon: <CalendarCheck className="h-5 w-5" />,
      accent: 'rose' as const,
      subtext: 'This year',
    },
  ];

  return (
    <PageLayout>
      <div className="space-y-6 pt-2">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Volunteer Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Overview of your volunteering impact</p>
        </div>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <MetricCard
              key={m.title}
              title={m.title}
              value={m.value}
              icon={m.icon}
              accent={m.accent}
              subtext={m.subtext}
            />
          ))}
        </section>

        {/* Placeholder Chart Section */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Volunteer Hours Over Time</h2>
            <p className="text-sm text-gray-600">This is a placeholder. We’ll replace it with a live chart.</p>
          </div>
          <div className="w-full min-h-[220px] rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
            Chart placeholder (bar/line) with mocked data
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
