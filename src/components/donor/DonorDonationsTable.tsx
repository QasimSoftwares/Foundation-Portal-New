"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DonorDonation = {
  donation_id: string;
  donation_human_id: string;
  amount: number;
  currency: string;
  category_id: string | null;
  category_name: string | null;
  project_id: string | null;
  project_name: string | null;
  donation_date: string; // ISO date
  receipt_pdf_path: string | null;
};

interface Props {
  donations: DonorDonation[];
}

export default function DonorDonationsTable({ donations }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const onDownload = async (donationId: string) => {
    try {
      setDownloading(donationId);
      const res = await fetch(`/api/donor/receipts/${donationId}/download`);
      if (!res.ok) throw new Error(`Failed to download receipt (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${donationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">My Donations</h2>
        <p className="mt-1 text-sm text-gray-600">Download receipts when available</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donation</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {donations.length > 0 ? (
              donations.map((d) => (
                <TableRow key={d.donation_id}>
                  <TableCell className="font-medium">{d.donation_human_id}</TableCell>
                  <TableCell>{d.project_name ?? "-"}</TableCell>
                  <TableCell>{d.category_name ?? "-"}</TableCell>
                  <TableCell className="text-right">{`${d.currency} ${Number(d.amount || 0).toLocaleString()}`}</TableCell>
                  <TableCell>{new Date(d.donation_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                  <TableCell className="text-center">
                    {d.receipt_pdf_path ? (
                      <Button size="sm" variant="default" onClick={() => onDownload(d.donation_id)} disabled={downloading === d.donation_id}>
                        {downloading === d.donation_id ? 'Downloading…' : 'Download'}
                      </Button>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  No donations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
