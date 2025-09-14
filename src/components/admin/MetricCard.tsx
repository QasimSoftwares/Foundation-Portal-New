"use client";

import React from "react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  className?: string;
  accent?: "green" | "blue" | "amber" | "rose";
};

const accentClasses: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
};

export function MetricCard({ title, value, subtext, icon, className, accent = "blue" }: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md",
        className
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className="mt-2 flex items-end gap-2">
              <h3 className="text-2xl font-semibold text-gray-900">{value}</h3>
              {subtext ? <span className="text-xs text-gray-400">{subtext}</span> : null}
            </div>
          </div>
          {icon ? (
            <span className={cn("inline-flex items-center rounded-lg p-2", accentClasses[accent])}>{icon}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MetricCard;
