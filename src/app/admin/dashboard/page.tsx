"use client";

import { Users, Coins, Heart, Shield } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import RecentActivity from "@/components/admin/RecentActivity";
import QuickActions from "@/components/admin/QuickActions";

export default function AdminDashboardPage() {
  // Placeholder metric values; wire up to RPC/data later
  const metrics = [
    { title: "Total Donors", value: 128, icon: <Heart className="h-5 w-5" />, accent: "rose" as const },
    { title: "Total Donations", value: "PKR 1.2M", icon: <Coins className="h-5 w-5" />, accent: "amber" as const },
    { title: "Total Volunteers", value: 56, icon: <Users className="h-5 w-5" />, accent: "blue" as const },
    { title: "Total Members", value: 34, icon: <Shield className="h-5 w-5" />, accent: "green" as const },
  ];

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Overview of donors, donations, volunteers, and members</p>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.title} title={m.title} value={m.value} icon={m.icon} accent={m.accent} />
        ))}
      </section>

      {/* Main content area: Recent Activity + Quick Actions */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </section>

      {/* Notes for data integration */}
      <section className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
        <h2 className="mb-1 font-semibold text-gray-900">Integration Notes</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Replace metric placeholders by calling centralized RPC endpoints (for example: supabase.rpc("get_admin_metrics")) in a
            client component or server action. Keep auth via centralized context/middleware.
          </li>
          <li>
            Wire Recent Activity to a paginated RPC (for example: supabase.rpc("get_recent_activity", with a limit of 20)) and stream in the
            list. Retain scroll behavior.
          </li>
          <li>
            Connect Quick Actions to routes or modals that use existing API routes and CSRF-protected actions.
          </li>
          <li>
            Do not instantiate new Supabase clients here. Consume session/role via `AuthProvider` and `RoleHydrator`.
          </li>
        </ul>
      </section>
    </div>
  );
}
