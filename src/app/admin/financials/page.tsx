"use client";

import { DollarSign, TrendingUp, Users, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import MetricCard from "@/components/admin/MetricCard";
import RecentActivity from "@/components/admin/RecentActivity";
import QuickActions from "@/components/admin/QuickActions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function FinancialsPage() {
  const [metrics, setMetrics] = useState([
    { title: "Total Donations", value: "PKR 2.4M", icon: <DollarSign className="h-5 w-5" />, accent: "green" as const, subtext: "All time" },
    { title: "Monthly Donations", value: "PKR 180K", icon: <TrendingUp className="h-5 w-5" />, accent: "blue" as const, subtext: "This month" },
    { title: "Active Donors", value: "156", icon: <Users className="h-5 w-5" />, accent: "rose" as const, subtext: "Contributing donors" },
    { title: "Pending Requests", value: "12", icon: <FileText className="h-5 w-5" />, accent: "amber" as const, subtext: "Awaiting approval" },
  ]);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Financials Management</h1>
        <p className="mt-1 text-sm text-gray-600">Overview of donations, expenses, and financial activities</p>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            accent={metric.accent}
          />
        ))}
      </section>

      {/* Navigation Links */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Donations</h2>
          <p className="text-sm text-gray-600 mb-4">Manage and track donations</p>
          <Link href="/admin/financials/donations">
            <Button>Go to Donations</Button>
          </Link>
        </div>
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Expenses</h2>
          <p className="text-sm text-gray-600 mb-4">Track and manage expenses</p>
          <Link href="/admin/financials/expenses">
            <Button>Go to Expenses</Button>
          </Link>
        </div>
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
    </div>
  );
}
