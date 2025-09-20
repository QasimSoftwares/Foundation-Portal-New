"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Heart, Clock, TrendingUp, DollarSign, Loader2, CheckCircle2, XCircle } from "lucide-react";
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

// Placeholder metrics for volunteers
const initialVolunteerMetrics = [
  {
    title: "Total Volunteers",
    value: "152",
    icon: <Users className="h-5 w-5" />,
    accent: "blue" as const,
    isLoading: false,
  },
  {
    title: "Pending Volunteer Requests",
    value: "18",
    icon: <Clock className="h-5 w-5" />,
    accent: "amber" as const,
    isLoading: false,
  },
  {
    title: "Approved Volunteers",
    value: "120",
    icon: <CheckCircle2 className="h-5 w-5" />,
    accent: "green" as const,
    isLoading: false,
  },
  {
    title: "Rejected Volunteers",
    value: "14",
    icon: <XCircle className="h-5 w-5" />,
    accent: "rose" as const,
    isLoading: false,
  },
];

// Mock data for volunteer requests
const mockVolunteerRequests: TransformedRequest[] = [
  {
    id: 'req_v_001',
    full_name: 'Ali Khan',
    email: 'ali.khan@example.com',
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'req_v_002',
    full_name: 'Fatima Ahmed',
    email: 'fatima.ahmed@example.com',
    status: 'approved',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'req_v_003',
    full_name: 'Zainab Bibi',
    email: 'zainab.bibi@example.com',
    status: 'rejected',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function VolunteersPage() {
  const [metrics, setMetrics] = useState(initialVolunteerMetrics);
  const [requests, setRequests] = useState<TransformedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // TODO: Replace with real data fetching from the backend
  const fetchVolunteerData = useCallback(async () => {
    setIsLoading(true);
    logger.info('Fetching mock volunteer data...');
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRequests(mockVolunteerRequests);
    // TODO: Fetch real metrics from the backend
    // For now, we use the static initialVolunteerMetrics
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchVolunteerData();
  }, [fetchVolunteerData]);

  const handleApprove = async (requestId: string) => {
    // TODO: Implement volunteer approval logic
    toast.info('Approve functionality to be implemented.');
  };

  const handleReject = async (requestId: string) => {
    // TODO: Implement volunteer rejection logic
    toast.info('Reject functionality to be implemented.');
  };

  const filteredRequests = requests.filter(request =>
    request.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            {filteredRequests.length > 0 ? (
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
