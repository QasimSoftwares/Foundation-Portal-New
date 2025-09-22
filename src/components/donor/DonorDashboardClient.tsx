"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Heart, ListChecks, Layers3 } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The SVGBarChart can remain here as it's a pure presentation component
function SVGBarChart({ data, max, height = 220, barColor = '#2563eb' }: { data: Array<{ date: string; amount: number }>; max: number; height?: number; barColor?: string }) {
  const padding = 32;
  const chartHeight = height - padding * 1.5;
  const width = Math.max(600, data.length * 48);
  const barWidth = Math.max(16, (width - padding * 2) / (data.length * 1.5));
  const step = (width - padding * 2) / data.length;

  const yScale = (val: number) => (max > 0 ? (val / max) * chartHeight : 0);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });

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
            <title>{`${formatDate(d.date)} — PKR ${d.amount.toLocaleString()}`}</title>
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

type Metric = {
  title: string;
  value: string;
  icon?: React.ReactNode;
  accent: "green" | "blue" | "amber" | "rose";
  subtext: string;
};

interface DonorDashboardClientProps {
  initialMetrics: Metric[];
  initialSummary: Array<{ donation_date: string; amount: number; currency: string; category_name: string | null; project_name: string | null }>;
  initialCategories: Array<{ donation_category_id: string; donation_category_name: string }>;
  initialProjects: Array<{ project_id: string; project_name: string }>;
}

export default function DonorDashboardClient({ 
  initialMetrics, 
  initialSummary, 
  initialCategories, 
  initialProjects 
}: DonorDashboardClientProps) {
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics);
  const [summary, setSummary] = useState(initialSummary);
  const [categories] = useState(initialCategories);
  const [projects] = useState(initialProjects);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false); // Initially false as we have initial data

  // Effect to re-fetch summary when filters change
  useEffect(() => {
    // Don't run on initial render
    if (selectedCategory === null && selectedProject === null) {
      // When filters are cleared, revert to initial summary data
      setSummary(initialSummary);
      return;
    }

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
  }, [selectedCategory, selectedProject, initialSummary]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of summary) {
      const key = row.donation_date;
      map.set(key, (map.get(key) || 0) + Number(row.amount || 0));
    }
    const items = Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return items;
  }, [summary]);

  const maxAmount = useMemo(() => chartData.reduce((m, x) => Math.max(m, x.amount), 0), [chartData]);

  return (
    <>
      {/* Metrics Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m: Metric) => (
          <MetricCard
            key={m.title}
            title={m.title}
            value={m.value}
            icon={m.icon}
            accent={m.accent}
          />
        ))}
      </section>

      {/* My Donations Overview (Chart) */}
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
    </>
  );
}
