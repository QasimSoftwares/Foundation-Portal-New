'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/utils/logger';
import { useToast } from '@/components/ui/use-toast';
import { PageLayout } from '@/components/layout/PageLayout';

interface PendingRequest {
  request_id: string;
  user_id: string;
  role_requested: string;
  status: string;
  created_at: string;
  full_name: string;
  email: string;
}

export default function ManageRequestsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/requests/pending');
      if (!response.ok) {
        throw new Error('Failed to fetch pending requests.');
      }
      const data = await response.json();
      setRequests(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred.');
      logger.error('Error fetching requests:', { error });
      setError(error.message);
      toast({ title: 'Error', description: 'Could not load pending requests.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleRequest = async (requestId: string, action: 'approve' | 'reject', role: string) => {
    try {
      const response = await fetch('/api/admin/requests/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, action, role }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.');
      }

      toast({ title: 'Success', description: `Request has been ${action}d.` });
      // Refresh the list of requests
      fetchRequests();

    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred.');
      logger.error(`Error ${action}ing request:`, { error });
      toast({ title: 'Error', description: `Could not ${action} the request.`, variant: 'destructive' });
    }
  };

  return (
    <PageLayout title="Manage Role Requests">
      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading requests...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && requests.length === 0 && <p>No pending requests.</p>}
          {!loading && !error && requests.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role Requested</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.request_id}>
                    <TableCell>{req.full_name}</TableCell>
                    <TableCell>{req.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{req.role_requested}</Badge>
                    </TableCell>
                    <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" onClick={() => handleRequest(req.request_id, 'approve', req.role_requested)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRequest(req.request_id, 'reject', req.role_requested)}>
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
