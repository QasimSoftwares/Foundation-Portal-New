"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import MetricCard from "@/components/admin/MetricCard";
import { logger } from "@/lib/utils/logger";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TransformedRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  updated_at: string;
  created_at: string;
  full_name: string;
  email: string;
}

// Initial metrics skeleton (loading state)
const initialVolunteerMetrics = [
  {
    title: "Total Volunteers",
    value: "-",
    icon: <Users className="h-5 w-5" />,
    accent: "blue" as const,
    isLoading: true,
  },
  {
    title: "Pending Volunteer Requests",
    value: "-",
    icon: <Clock className="h-5 w-5" />,
    accent: "amber" as const,
    isLoading: true,
  },
  {
    title: "Approved Volunteers",
    value: "-",
    icon: <CheckCircle2 className="h-5 w-5" />,
    accent: "green" as const,
    isLoading: true,
  },
  {
    title: "Rejected Volunteers",
    value: "-",
    icon: <XCircle className="h-5 w-5" />,
    accent: "rose" as const,
    isLoading: true,
  },
];

// NOTE: Data now fetched from /api/admin/volunteers endpoints

export default function VolunteersPage() {
  const [metrics, setMetrics] = useState(initialVolunteerMetrics);
  const [requests, setRequests] = useState<TransformedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // Fetch metrics and pending requests from server APIs
  const fetchVolunteerData = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('Fetching volunteer metrics and requests...');

      const [metricsRes, listRes] = await Promise.all([
        fetch('/api/admin/volunteers/metrics', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }),
        fetch('/api/admin/volunteers/list?status=pending&page=1&pageSize=50', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      if (!metricsRes.ok) {
        const err = await metricsRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to fetch volunteer metrics');
      }
      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to fetch volunteer list');
      }

      const metricsData = await metricsRes.json();
      const listData = await listRes.json();

      // Update metrics values
      setMetrics(prev => prev.map(m => {
        switch (m.title) {
          case 'Total Volunteers':
            return { ...m, value: Number(metricsData.totalVolunteers ?? 0).toString(), isLoading: false };
          case 'Pending Volunteer Requests':
            return { ...m, value: Number(metricsData.pendingVolunteerRequests ?? 0).toString(), isLoading: false };
          case 'Approved Volunteers':
            return { ...m, value: Number(metricsData.approvedVolunteers ?? 0).toString(), isLoading: false };
          case 'Rejected Volunteers':
            return { ...m, value: Number(metricsData.rejectedVolunteers ?? 0).toString(), isLoading: false };
          default:
            return { ...m, isLoading: false };
        }
      }));

      // Normalize list items to TransformedRequest[]
      const items: any[] = Array.isArray(listData?.items) ? listData.items : [];
      const transformed: TransformedRequest[] = items.map((it) => ({
        id: String(it.id),
        full_name: it.full_name || 'Unknown',
        email: it.email || 'No email',
        status: (it.status || 'pending') as 'pending' | 'approved' | 'rejected',
        created_at: it.created_at || new Date().toISOString(),
        updated_at: it.updated_at || it.created_at || new Date().toISOString(),
      }));
      setRequests(transformed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to load volunteers: ${message}`);
      logger.error('Error fetching volunteer data', { error: error instanceof Error ? error : new Error(String(error)) });
      // Mark metrics as not loading to avoid skeletons forever
      setMetrics(prev => prev.map(m => ({ ...m, value: 'Error', isLoading: false })));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVolunteerData();
  }, [fetchVolunteerData]);

  const handleApprove = async (requestId: string) => {
    try {
      setIsUpdating(prev => ({ ...prev, [requestId]: true }));
      logger.info('Approving volunteer request', { requestId });
      
      const response = await fetch('/api/admin/requests/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action: 'approve',
          role: 'volunteer',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'Failed to approve volunteer request');
      }

      toast.success('Volunteer request approved successfully');
      // Refresh the data
      await fetchVolunteerData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error approving volunteer request', { error: error instanceof Error ? error : new Error(String(error)) });
      toast.error(`Failed to approve request: ${message}`);
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setIsUpdating(prev => ({ ...prev, [requestId]: true }));
      logger.info('Rejecting volunteer request', { requestId });
      
      const response = await fetch('/api/admin/requests/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action: 'reject',
          role: 'volunteer',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'Failed to reject volunteer request');
      }

      toast.success('Volunteer request rejected');
      // Refresh the data
      await fetchVolunteerData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error rejecting volunteer request', { error: error instanceof Error ? error : new Error(String(error)) });
      toast.error(`Failed to reject request: ${message}`);
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const filteredRequests = requests.filter(request =>
    request.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Volunteer Management</h1>
        <p className="mt-1 text-sm text-gray-600">Manage volunteers and review pending applications</p>
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
            isLoading={metric.isLoading}
          />
        ))}
      </section>

      {/* Search and Add Donor */}
      <div className="flex items-center justify-between pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search volunteers..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button className="ml-4" onClick={() => router.push('/admin/volunteers/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Volunteer
        </Button>
      </div>

      {/* Requests Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    Loading volunteer requests...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRequests.length > 0 ? (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.id.substring(0, 8)}...</TableCell>
                  <TableCell>{request.full_name}</TableCell>
                  <TableCell>{request.email}</TableCell>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        request.status === 'approved'
                          ? 'default'
                          : request.status === 'rejected'
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={isUpdating[request.id] || request.status !== 'pending'}
                    >
                      {isUpdating[request.id] ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(request.id)}
                      disabled={isUpdating[request.id] || request.status !== 'pending'}
                    >
                      {isUpdating[request.id] ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {requests.length === 0 ? 'No volunteer requests found.' : 'No matching requests found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
