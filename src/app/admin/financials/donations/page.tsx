"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Heart, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchWithCSRF } from "@/lib/http/csrf-interceptor";
import MetricCard from "@/components/admin/MetricCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type DonationRequest = {
  donation_request_id: string;
  donor_number: string;
  donor_name: string;
  amount: number;
  currency: string;
  category_name: string;
  project_name: string;
  mode_of_payment: string;
  donation_type: string;
  donation_date: string;
  status: string;
  created_at: string;
};

export default function DonationsPage() {
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDonations, setTotalDonations] = useState<number | null>(null);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const res = await fetchWithCSRF("/api/admin/financials/donation-requests", {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load donation requests");
        }
        setRequests(data.requests || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    loadRequests();
  }, []);

  useEffect(() => {
    const loadTotalDonations = async () => {
      try {
        const res = await fetch('/api/admin/metrics/total-donations', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load total donations');
        }
        setTotalDonations(Number(data.total_donations ?? 0));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        toast.error(msg);
        setTotalDonations(null);
      }
    };
    loadTotalDonations();
  }, []);

  const handleApprove = async (requestId: string) => {
    const t = toast.loading("Approving donation request...");
    try {
      const res = await fetchWithCSRF(`/api/admin/financials/donation-requests/${requestId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to approve donation request");
      }
      toast.success("Donation request approved", { id: t });
      // Update the request status in the list
      setRequests(requests.map(r => r.donation_request_id === requestId ? { ...r, status: "Approved" } : r));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      toast.error(msg, { id: t });
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    const t = toast.loading("Rejecting donation request...");
    try {
      const res = await fetchWithCSRF(`/api/admin/financials/donation-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reject donation request");
      }
      toast.success("Donation request rejected", { id: t });
      // Update the request status in the list
      setRequests(requests.map(r => r.donation_request_id === requestId ? { ...r, status: "Rejected" } : r));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      toast.error(msg, { id: t });
    }
  };

  const pendingRequests = requests.filter(r => r.status === "Pending");

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Donations Management</h1>
          <p className="mt-1 text-sm text-gray-600">Track and manage donation requests</p>
        </div>
        <a href="/admin/financials/donations/new" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-brand-blue text-white hover:bg-blue-700">
          Add Donation Request
        </a>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Donations"
          value={totalDonations === null ? '0' : `PKR ${totalDonations.toLocaleString()}`}
          isLoading={totalDonations === null}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="green"
        />
        <MetricCard
          title="Total Requests"
          value={requests.length.toString()}
          icon={<DollarSign className="h-5 w-5" />}
          accent="green"
        />
        <MetricCard
          title="Pending Requests"
          value={pendingRequests.length.toString()}
          icon={<FileText className="h-5 w-5" />}
          accent="amber"
        />
      </section>

      {/* Donation Requests Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : pendingRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No pending donation requests.
                </TableCell>
              </TableRow>
            ) : (
              pendingRequests.map((request) => (
                <TableRow key={request.donation_request_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.donor_name}</div>
                      <div className="text-sm text-gray-500">{request.donor_number}</div>
                    </div>
                  </TableCell>
                  <TableCell>{request.amount} {request.currency}</TableCell>
                  <TableCell>{request.category_name}</TableCell>
                  <TableCell>{request.project_name}</TableCell>
                  <TableCell>{new Date(request.donation_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === "Pending" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {request.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(request.donation_request_id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request.donation_request_id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
