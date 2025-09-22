"use client";

import { useEffect, useMemo, useState } from "react";
import MetricCard from "@/components/admin/MetricCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Metric = {
  title: string;
  value: string;
  icon?: React.ReactNode;
  accent: "green" | "blue" | "amber" | "rose";
  subtext: string;
};

type RecentDonation = {
  date: string;
  donationId: string;
  amount: number;
  category: string;
  project: string;
  status: 'Completed' | 'Pending' | 'Failed';
};

interface DonorDashboardClientProps {
  initialMetrics: Metric[];
  initialRecentDonations: RecentDonation[];
  initialSummary: Array<{ donation_date: string; amount: number; currency: string; category_name: string | null; project_name: string | null }>;
  initialCategories: Array<{ donation_category_id: string; donation_category_name: string }>;
  initialProjects: Array<{ project_id: string; project_name: string }>;
}

export default function DonorDashboardClient({
  initialMetrics,
  initialRecentDonations,
  initialSummary,
  initialCategories,
  initialProjects,
}: DonorDashboardClientProps) {
  // TODO: In the future, this state can be updated via client-side fetching for real-time updates
  const [metrics] = useState<Metric[]>(initialMetrics);
  const [recentDonations] = useState<RecentDonation[]>(initialRecentDonations);
  const [summary, setSummary] = useState(initialSummary);
  const [categories] = useState(initialCategories);
  const [projects] = useState(initialProjects);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // Fetch summary when filters change
  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      setLoadingSummary(true);
      try {
        const url = new URL('/api/donor/summary', window.location.origin);
        if (selectedCategory) url.searchParams.set('category_id', selectedCategory);
        if (selectedProject) url.searchParams.set('project_id', selectedProject);
        const res = await fetch(url.toString(), { headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) throw new Error(`Failed to load summary: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSummary(data.summary || []);
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [selectedCategory, selectedProject]);

  // Simple SVG bar chart (consistent with app styling)
  function SVGBarChart({ data, max, height = 220, barColor = '#2563eb' }: { data: Array<{ date: string; amount: number; category?: string | null; project?: string | null }>; max: number; height?: number; barColor?: string }) {
    const padding = 32;
    const chartHeight = height - padding * 1.5;
    const width = Math.max(600, data.length * 48);
    const barWidth = Math.max(16, (width - padding * 2) / (data.length * 1.5));
    const step = (width - padding * 2) / Math.max(1, data.length);
    const yScale = (val: number) => (max > 0 ? (val / max) * chartHeight : 0);
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });

    // y-axis ticks
    const yTicks = 4;
    const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max / yTicks) * i));

    return (
      <svg width={width} height={height} role="img" aria-label="Donations over time">
        {tickValues.map((tv, i) => {
          const y = height - padding - (yScale(tv));
          return (
            <g key={`grid-${i}`}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={8} y={y + 4} fontSize={10} fill="#6b7280">{tv.toLocaleString()}</text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const barH = yScale(d.amount);
          const x = padding + i * step + (step - barWidth) / 2;
          const y = height - padding - barH;
          return (
            <g key={`bar-${i}`}>
              <rect x={x} y={y} width={barWidth} height={barH} fill={barColor} rx={4} />
              <title>{`${formatDate(d.date)} — PKR ${d.amount.toLocaleString()}${d.project ? ` — ${d.project}` : ''}${d.category ? ` — ${d.category}` : ''}`}</title>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = padding + i * step + step / 2;
          const y = height - padding + 14;
          return (
            <text key={`label-${i}`} x={x} y={y} fontSize={10} fill="#6b7280" textAnchor="middle">
              {formatDate(d.date)}
            </text>
          );
        })}
      </svg>
    );
  }

  const chartData = useMemo(() => {
    return summary.map((row) => ({
      date: row.donation_date,
      amount: Number(row.amount || 0),
      category: row.category_name,
      project: row.project_name,
    }));
  }, [summary]);

  const maxAmount = useMemo(() => chartData.reduce((m, x) => Math.max(m, x.amount), 0), [chartData]);

  return (
    <>
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

      {/* My Donations Overview (Chart with filters) */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Donations Overview</h2>
            <p className="text-sm text-gray-600">Track your donations over time</p>
          </div>
          <div className="flex gap-3">
            <div className="w-56">
              <Select onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)} value={selectedCategory ?? 'all'}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.donation_category_id} value={c.donation_category_id}>
                      {c.donation_category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-56">
              <Select onValueChange={(v) => setSelectedProject(v === 'all' ? null : v)} value={selectedProject ?? 'all'}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px]">
            {loadingSummary ? (
              <div className="h-48 w-full animate-pulse rounded bg-gray-100" />
            ) : chartData.length === 0 ? (
              <div className="h-48 w-full rounded border border-dashed border-gray-200 p-4 text-sm text-gray-600">
                No data for the selected filters.
              </div>
            ) : (
              <SVGBarChart data={chartData} max={maxAmount} height={220} barColor="#2563eb" />
            )}
          </div>
        </div>
      </section>

      {/* Recent Donations Table */}
      {/* TODO: This table will be powered by a paginated RPC call to `get_donor_donations` */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Donations</h2>
          <p className="mt-1 text-sm text-gray-600">A list of your most recent contributions.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donation ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDonations.length > 0 ? (
                recentDonations.map((donation) => (
                  <TableRow key={donation.donationId}>
                    <TableCell className="font-medium">{new Date(donation.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                    <TableCell>{donation.donationId}</TableCell>
                    <TableCell>{donation.category}</TableCell>
                    <TableCell>{donation.project}</TableCell>
                    <TableCell className="text-right">{`PKR ${donation.amount.toLocaleString()}`}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={donation.status === 'Completed' ? 'default' : 'secondary'}>
                        {donation.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    You have no recent donations.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}
