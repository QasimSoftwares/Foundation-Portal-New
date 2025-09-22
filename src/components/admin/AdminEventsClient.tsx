"use client";

import { useEffect, useMemo, useState } from "react";
import MetricCard from "@/components/admin/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Metrics = {
  total_events: number;
  active_events: number;
  completed_events: number;
  cancelled_events: number;
  total_volunteers_required: number;
};

type EventRow = {
  event_id: string;
  event_name: string;
  location: string | null;
  volunteers_required: number | null;
  event_status: "active" | "completed" | "cancelled";
  start_date: string | null;
  end_date: string | null;
};

export default function AdminEventsClient() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [rows, setRows] = useState<EventRow[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [mRes, lRes] = await Promise.all([
        fetch("/api/admin/events/metrics", { cache: "no-store" }),
        fetch("/api/admin/events/list", { cache: "no-store" }),
      ]);
      if (!mRes.ok) throw new Error("Failed to load metrics");
      if (!lRes.ok) throw new Error("Failed to load events");
      const mJson = await mRes.json();
      const lJson = await lRes.json();
      setMetrics(mJson.metrics || null);
      setRows(lJson.events || []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load events");
    } finally {
      setLoading(false);
    }

  }

  async function onUpdate() {
    if (!updateForm.event_id) {
      toast.error("Select an event to update");
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: updateForm.event_id,
          event_name: updateForm.event_name || null,
          location: updateForm.location || null,
          volunteers_required: updateForm.volunteers_required ? Number(updateForm.volunteers_required) : null,
          aim_of_event: updateForm.aim_of_event || null,
          start_date: updateForm.start_date || null,
          end_date: updateForm.end_date || null,
          site_status: updateForm.site_status,
          event_status: updateForm.event_status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update event");
      toast.success("Event updated");
      setShowUpdateModal(false);
      await loadData();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update event");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadData();
    })();
    return () => { cancelled = true; };
  }, []);

  // Modal form state
  const [form, setForm] = useState({
    event_name: "",
    location: "",
    volunteers_required: "",
    aim_of_event: "",
    start_date: "",
    end_date: "",
    site_status: "on_site" as "on_site" | "remote",
  });

  const [updateForm, setUpdateForm] = useState({
    event_id: "",
    event_name: "",
    location: "",
    volunteers_required: "",
    aim_of_event: "",
    start_date: "",
    end_date: "",
    site_status: "on_site" as "on_site" | "remote",
    event_status: "active" as "active" | "completed" | "cancelled",
  });

  function openUpdateModal() {
    // Prefill defaults if rows exist
    if (rows.length > 0) {
      const first = rows[0];
      setUpdateForm({
        event_id: first.event_id,
        event_name: first.event_name ?? "",
        location: first.location ?? "",
        volunteers_required: first.volunteers_required != null ? String(first.volunteers_required) : "",
        aim_of_event: "",
        start_date: first.start_date ?? "",
        end_date: first.end_date ?? "",
        site_status: (first as any).site_status ?? "on_site",
        event_status: first.event_status,
      });
    }
    setShowUpdateModal(true);
  }

  async function onCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: form.event_name,
          location: form.location || null,
          volunteers_required: form.volunteers_required ? Number(form.volunteers_required) : null,
          aim_of_event: form.aim_of_event || null,
          start_date: form.start_date,
          end_date: form.end_date || null,
          site_status: form.site_status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create event");
      toast.success("Event created", { description: `Event ID: ${data.event_id}` });
      setShowModal(false);
      setForm({ event_name: "", location: "", volunteers_required: "", aim_of_event: "", start_date: "", end_date: "", site_status: "on_site" });
      await loadData();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  const metricCards = useMemo(() => {
    const m = metrics;
    return [
      { title: "Total Events", value: `${m?.total_events ?? 0}`, accent: "blue" as const, subtext: "All time" },
      { title: "Active Events", value: `${m?.active_events ?? 0}`, accent: "green" as const, subtext: "Ongoing" },
      { title: "Volunteers Required", value: `${m?.total_volunteers_required ?? 0}`, accent: "amber" as const, subtext: "Across events" },
      { title: "Completed Events", value: `${m?.completed_events ?? 0}`, accent: "rose" as const, subtext: "Historical" },
      { title: "Cancelled Events", value: `${m?.cancelled_events ?? 0}`, accent: "rose" as const, subtext: "Historical" },
    ];
  }, [metrics]);

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-600">Manage and review events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openUpdateModal}>Update Event</Button>
          <Button onClick={() => setShowModal(true)}>Add Event</Button>
        </div>
      </div>

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.slice(0,4).map((m) => (
          <MetricCard key={m.title} title={m.title} value={m.value} accent={m.accent} subtext={m.subtext} />
        ))}
      </section>
      {/* Second row for Cancelled if needed */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.slice(4).map((m) => (
          <MetricCard key={m.title} title={m.title} value={m.value} accent={m.accent} subtext={m.subtext} />
        ))}
      </section>

      {/* Events table */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Events</h2>
          <p className="mt-1 text-sm text-gray-600">Listing fetched from API</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Event Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Volunteers Required</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No events found.</td></tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.event_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.location ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.volunteers_required ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{r.event_status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.start_date ? new Date(r.start_date).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.end_date ? new Date(r.end_date).toLocaleDateString() : '-'}</td>
                  </tr>
                ))
              )}

      {/* Update Modal - Moved outside table */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUpdateModal(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Update Event</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Select Event</label>
                <Select value={updateForm.event_id} onValueChange={(v) => {
                  const found = rows.find(r => r.event_id === v);
                  if (found) {
                    setUpdateForm(prev => ({
                      ...prev,
                      event_id: found.event_id,
                      event_name: found.event_name ?? "",
                      location: found.location ?? "",
                      volunteers_required: found.volunteers_required != null ? String(found.volunteers_required) : "",
                      start_date: found.start_date ?? "",
                      end_date: found.end_date ?? "",
                      event_status: found.event_status,
                    }));
                  } else {
                    setUpdateForm(prev => ({ ...prev, event_id: v }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map(r => (
                      <SelectItem key={r.event_id} value={r.event_id}>{r.event_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Event Name</label>
                <Input value={updateForm.event_name} onChange={(e) => setUpdateForm({ ...updateForm, event_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <Input value={updateForm.location} onChange={(e) => setUpdateForm({ ...updateForm, location: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Volunteers Required</label>
                <Input type="number" value={updateForm.volunteers_required} onChange={(e) => setUpdateForm({ ...updateForm, volunteers_required: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Aim of Event</label>
                <Textarea value={updateForm.aim_of_event} onChange={(e) => setUpdateForm({ ...updateForm, aim_of_event: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <Input type="date" value={updateForm.start_date} onChange={(e) => setUpdateForm({ ...updateForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <Input type="date" value={updateForm.end_date} onChange={(e) => setUpdateForm({ ...updateForm, end_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Site Status</label>
                <Select value={updateForm.site_status} onValueChange={(v) => setUpdateForm({ ...updateForm, site_status: v as any })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_site">On-site</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Status</label>
                <Select value={updateForm.event_status} onValueChange={(v) => setUpdateForm({ ...updateForm, event_status: v as any })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowUpdateModal(false)}>Cancel</Button>
              <Button onClick={onUpdate} disabled={updating || !updateForm.event_id}>Update</Button>
            </div>
          </div>
        </div>
      )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Modal - Moved outside table */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Add Event</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Event Name</label>
                <Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Volunteers Required</label>
                <Input type="number" value={form.volunteers_required} onChange={(e) => setForm({ ...form, volunteers_required: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Aim of Event</label>
                <Textarea value={form.aim_of_event} onChange={(e) => setForm({ ...form, aim_of_event: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Site Status</label>
                <Select value={form.site_status} onValueChange={(v) => setForm({ ...form, site_status: v as any })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_site">On-site</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={onCreate} disabled={creating || !form.event_name || !form.start_date}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
