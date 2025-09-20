"use client";

import { DollarSign, TrendingDown, FileText, AlertCircle } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ExpensesPage() {
  const metrics = [
    { title: "Total Expenses", value: "Coming Soon", icon: <DollarSign className="h-5 w-5" />, accent: "rose" as const, subtext: "All time" },
    { title: "Monthly Expenses", value: "Coming Soon", icon: <TrendingDown className="h-5 w-5" />, accent: "amber" as const, subtext: "This month" },
    { title: "Pending Approvals", value: "Coming Soon", icon: <FileText className="h-5 w-5" />, accent: "blue" as const, subtext: "Awaiting review" },
    { title: "Budget Variance", value: "Coming Soon", icon: <AlertCircle className="h-5 w-5" />, accent: "green" as const, subtext: "Current vs Planned" },
  ];

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Expenses Management</h1>
        <p className="mt-1 text-sm text-gray-600">Track and manage organizational expenses</p>
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

      {/* Expenses Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No expenses recorded yet.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Placeholder note */}
      <section className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
        <h2 className="mb-1 font-semibold text-gray-900">Coming Soon</h2>
        <p>This section will include expense tracking, approval workflows, and budget management features.</p>
      </section>
    </div>
  );
}
