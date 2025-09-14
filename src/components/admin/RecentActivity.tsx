"use client";

import React from "react";

export type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  category?: "donation" | "donor" | "volunteer" | "system" | "member";
};

export function RecentActivity({ items = [] as ActivityItem[] }: { items?: ActivityItem[] }) {
  const data = items.length
    ? items
    : [
        {
          id: "1",
          title: "New donation received",
          description: "PKR 25,000 by John Doe",
          timestamp: "2m ago",
          category: "donation",
        },
        {
          id: "2",
          title: "Volunteer application approved",
          description: "Ayesha Khan approved as Volunteer",
          timestamp: "15m ago",
          category: "volunteer",
        },
        {
          id: "3",
          title: "New donor added",
          description: "Acme Foods Pvt. Ltd.",
          timestamp: "1h ago",
          category: "donor",
        },
        {
          id: "4",
          title: "System maintenance",
          description: "Nightly backup completed",
          timestamp: "Today, 02:00 AM",
          category: "system",
        },
      ];

  return (
    <div className="h-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
        <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View all</button>
      </div>
      <div className="h-[360px] overflow-y-auto px-4 py-2 sm:px-5">
        <ul className="space-y-3">
          {data.map((item) => (
            <li key={item.id} className="group rounded-lg border border-transparent p-3 transition hover:border-gray-100 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <span className="text-xs text-gray-400">{item.timestamp}</span>
              </div>
              {item.description ? (
                <p className="mt-1 text-sm text-gray-600">{item.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default RecentActivity;
