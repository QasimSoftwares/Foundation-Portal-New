"use client";

import React from "react";
import { Plus, UserPlus, Coins, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickAction = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  color?: "emerald" | "blue" | "amber" | "rose";
};

const colorClasses: Record<NonNullable<QuickAction["color"]>, string> = {
  emerald:
    "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600 text-white",
  amber:
    "bg-amber-500 hover:bg-amber-600 focus-visible:outline-amber-500 text-white",
  rose: "bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600 text-white",
};

export function QuickActions({
  actions,
  title = "Quick Actions",
}: {
  actions?: QuickAction[];
  title?: string;
}) {
  const data: QuickAction[] =
    actions ?? (
      [
        {
          id: "add-donor",
          label: "Add New Donor",
          icon: <UserPlus className="h-5 w-5" />,
          color: "emerald",
        },
        {
          id: "add-donation",
          label: "Add New Donation",
          icon: <Coins className="h-5 w-5" />,
          color: "amber",
        },
        {
          id: "add-volunteer",
          label: "Add New Volunteer",
          icon: <Users className="h-5 w-5" />,
          color: "blue",
        },
        {
          id: "add-member",
          label: "Add New Member",
          icon: <Plus className="h-5 w-5" />,
          color: "rose",
        },
      ] as QuickAction[]
    );

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {data.map((action) => (
          <button
            key={action.id}
            type="button"
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              colorClasses[action.color ?? "emerald"]
            )}
            onClick={action.onClick}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
