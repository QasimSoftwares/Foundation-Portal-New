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
const initialMemberMetrics = [
  {
    title: "Total Members",
    value: "-",
    icon: <Users className="h-5 w-5" />,
    accent: "blue" as const,
    isLoading: true,
  },
  {
    title: "Pending Member Requests",
    value: "-",
    icon: <Clock className="h-5 w-5" />,
    accent: "amber" as const,
    isLoading: true,
  },
  {
    title: "Approved Members",
    value: "-",
    icon: <CheckCircle2 className="h-5 w-5" />,
    accent: "green" as const,
    isLoading: true,
  },
  {
    title: "Rejected Members",
    value: "-",
    icon: <XCircle className="h-5 w-5" />,
    accent: "rose" as const,
    isLoading: true,
  },
];

export default function MembersPage() {
  const [metrics, setMetrics] = useState(initialMemberMetrics);
  const [requests, setRequests] = useState<TransformedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // Fetch metrics and pending requests from server APIs
  const fetchMemberData = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('Fetching member metrics and requests...');

      const [metricsRes, listRes] = await Promise.all([
        fetch('/api/admin/members/metrics', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }),
        fetch('/api/admin/members/list?status=pending&page=1&pageSize=50', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      if (!metricsRes.ok) {
        const err = await metricsRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to fetch member metrics');
      }
      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to fetch member list');
      }

      const metricsData = await metricsRes.json();
      const listData = await listRes.json();

      logger.info('Successfully fetched member data', { metrics: metricsData, list: listData });

      // Update metrics with actual data
      setMetrics([
        {
          title: "Total Members",
          value: metricsData.totalMembers?.toString() || "0",
          icon: <Users className="h-5 w-5" />,
          accent: "blue" as const,
          isLoading: false,
        },
        {
          title: "Pending Member Requests",
          value: metricsData.pendingRequests?.toString() || "0",
          icon: <Clock className="h-5 w-5" />,
          accent: "amber" as const,
          isLoading: false,
        },
        {
          title: "Approved Members",
          value: metricsData.approvedMembers?.toString() || "0",
          icon: <CheckCircle2 className="h-5 w-5" />,
          accent: "green" as const,
          isLoading: false,
        },
        {
          title: "Rejected Members",
          value: metricsData.rejectedMembers?.toString() || "0",
          icon: <XCircle className="h-5 w-5" />,
          accent: "rose" as const,
          isLoading: false,
        },
      ]);

      // Set pending requests
      if (Array.isArray(listData.items)) {
        setRequests(listData.items);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('An unknown error occurred');
      logger.error('Error fetching member data:', { error: errorMessage });
      toast.error(`Failed to load member data: ${errorMessage.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  const handleApproveReject = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setIsUpdating(prev => ({ ...prev, [requestId]: true }));
      logger.info(`Processing ${action} for member request:`, { requestId });

      const response = await fetch(`/api/admin/requests/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action,
          role: 'member',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to ${action} member request`);
      }

      const result = await response.json();
      logger.info(`Successfully processed ${action} for member request:`, { requestId, result });
      
      // Refresh the data
      await fetchMemberData();
      
      toast.success(`Member request ${action}d successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('An unknown error occurred');
      logger.error(`Error processing ${action} for member request:`, { requestId, error: errorMessage });
      toast.error(`Failed to ${action} member request: ${errorMessage.message}`);
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const filteredRequests = requests.filter(request => 
    request.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Member Management</h1>
          <p className="text-muted-foreground">
            Manage member requests and view member statistics
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              accent={metric.accent}
              isLoading={metric.isLoading}
            />
          ))}
        </div>

        {/* Pending Requests */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold leading-none tracking-tight">
                Pending Member Requests
              </h2>
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search members..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="p-6 pt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRequests.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.full_name || 'N/A'}
                        </TableCell>
                        <TableCell>{request.email || 'N/A'}</TableCell>
                        <TableCell>
                          {new Date(request.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => handleApproveReject(request.id, 'approve')}
                              disabled={isUpdating[request.id]}
                            >
                              {isUpdating[request.id] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Approve
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => handleApproveReject(request.id, 'reject')}
                              disabled={isUpdating[request.id]}
                            >
                              {isUpdating[request.id] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Reject
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground" />
                <div className="space-y-1">
                  <h3 className="text-lg font-medium">No pending member requests</h3>
                  <p className="text-sm text-muted-foreground">
                    There are currently no pending member requests.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
