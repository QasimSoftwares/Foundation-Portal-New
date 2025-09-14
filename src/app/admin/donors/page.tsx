'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Input } from '@/components/ui/input';
import { Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import { TransformedRequest } from '@/types/request';

export default function DonorRequestsPage() {
  const [requests, setRequests] = useState<TransformedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  // Using sonner toast

  const fetchDonorRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('Fetching donor requests...');
      
      const response = await fetch('/api/admin/requests/pending?type=donor', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || 'Failed to fetch donor requests';
        const errorDetails = errorData?.details ? ` (${JSON.stringify(errorData.details)})` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }
      
      const data = await response.json();
      logger.debug('Raw API response:', data);
      
      if (!Array.isArray(data)) {
        throw new Error(`Invalid response format: expected an array, got ${typeof data}`);
      }
      
      // Log raw request data for debugging
      logger.debug('Raw request data:', data);
      
      // Type assertion since we trust the API response structure
      const formattedData = data as TransformedRequest[];
      
      logger.debug('Formatted requests:', formattedData);
      
      setRequests(formattedData);
      logger.info(`Formatted ${formattedData.length} donor requests`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorObject = error instanceof Error ? error : new Error('Unknown error');
      
      toast.error(`Failed to load donor requests: ${errorMessage}`);
      logger.error('Error in fetchDonorRequests:', { 
        error: errorObject,
        message: errorMessage,
        stack: errorObject.stack 
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDonorRequests();
  }, [fetchDonorRequests]);

  const handleApprove = async (requestId: string) => {
    try {
      setIsUpdating(prev => ({ ...prev, [requestId]: true }));
      
      const response = await fetch('/api/admin/requests/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action: 'approve',
          role: 'donor',
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to approve request');
      }

      // Optimistically update the UI
      setRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, status: 'approved', updated_at: new Date().toISOString() } 
            : req
        )
      );
      
      toast.success(responseData.message || 'Donor request approved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorObject = error instanceof Error ? error : new Error('Unknown error');
      toast.error(`Failed to approve request: ${errorMessage}`);
      logger.error('Error approving donor request:', { error: errorObject });
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setIsUpdating(prev => ({ ...prev, [requestId]: true }));
      
      const response = await fetch('/api/admin/requests/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action: 'reject',
          role: 'donor',
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to reject request');
      }

      // Optimistically update the UI
      setRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, status: 'rejected', updated_at: new Date().toISOString() } 
            : req
        )
      );
      
      toast.success(responseData.message || 'Donor request rejected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorObject = error instanceof Error ? error : new Error('Unknown error');
      toast.error(`Failed to reject request: ${errorMessage}`);
      logger.error('Error rejecting donor request:', { error: errorObject });
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Donor Requests</h1>
        <p className="mt-1 text-sm text-gray-600">Manage and review donor registration requests</p>
      </div>
      
      <div className="space-y-4">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search requests..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
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
                    {requests.length === 0 ? 'No donor requests found.' : 'No matching requests found.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
