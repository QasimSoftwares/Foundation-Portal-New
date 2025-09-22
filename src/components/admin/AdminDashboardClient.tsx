"use client";

import { useState, useEffect } from "react";
import { Users, Coins, Heart, Shield } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import MetricCard from "@/components/admin/MetricCard";

interface Metric {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: "rose" | "amber" | "blue" | "green";
  subtext: string;
}

interface AdminDashboardClientProps {
  initialMetrics: Metric[];
}

export default function AdminDashboardClient({ initialMetrics }: AdminDashboardClientProps) {
  const [metrics] = useState<Metric[]>(initialMetrics);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard 
          key={m.title} 
          title={m.title} 
          value={m.value} 
          icon={m.icon} 
          accent={m.accent}
        />
      ))}
    </section>
  );
}
