'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface ReceiptFormData {
  donorName: string;
  donorId: string;
  phoneNumber: string;
  address: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  donationDate: string;
  receiptNumber: string;
  transactionId: string;
}

export default function TestReceiptPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ReceiptFormData>({
    donorName: 'John Doe',
    donorId: `DONOR-${Math.floor(1000 + Math.random() * 9000)}`,
    phoneNumber: '+92 300 1234567',
    address: '123 Main Street\nLahore, Punjab 54000\nPakistan',
    amount: 5000,
    currency: 'PKR',
    paymentMethod: 'Bank Transfer',
    donationDate: formatDate(new Date()),
    receiptNumber: `RC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    transactionId: `TXN${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }));
  };

  const generateTestReceipt = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/test/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          donation_id: 'TEST-' + Date.now(),
          donor_id: formData.donorId,
          phone_number: formData.phoneNumber,
          address: formData.address,
          amount: formData.amount,
          currency: formData.currency,
          donor_name: formData.donorName,
          donation_date: formData.donationDate,
          receipt_number: formData.receiptNumber,
          payment_method: formData.paymentMethod,
          transaction_id: formData.transactionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate receipt');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Failed to generate receipt. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Form Section */}
        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle>Receipt Generator</CardTitle>
            <CardDescription>Customize and preview your donation receipt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="donorName">Donor Name</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    id="donorName"
                    name="donorName"
                    value={formData.donorName}
                    onChange={handleInputChange}
                    placeholder="Enter donor name"
                  />
                </div>
                <div>
                  <Input
                    id="donorId"
                    name="donorId"
                    value={formData.donorId}
                    onChange={handleInputChange}
                    placeholder="Donor ID"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="+92 300 1234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street\nLahore, Punjab 54000\nPakistan"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="flex">
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="rounded-r-none border-r-0 rounded-l-md border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="rounded-l-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="donationDate">Donation Date</Label>
                <Input
                  id="donationDate"
                  name="donationDate"
                  type="date"
                  value={formData.donationDate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  name="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={handleInputChange}
                  placeholder="RC-YYYY-XXXX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID</Label>
              <div className="flex gap-2">
                <Input
                  id="transactionId"
                  name="transactionId"
                  value={formData.transactionId}
                  onChange={handleInputChange}
                  placeholder="Transaction ID"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      transactionId: `TXN${Math.random().toString(36).substring(2, 10).toUpperCase()}`
                    }));
                  }}
                >
                  Generate
                </Button>
              </div>
            </div>

            <Button 
              onClick={generateTestReceipt}
              disabled={isLoading}
              className="w-full mt-4"
            >
              {isLoading ? 'Generating Receipt...' : 'Generate Receipt'}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <div className="w-full md:w-2/3">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Preview</CardTitle>
              <CardDescription>Your receipt will appear here</CardDescription>
            </CardHeader>
            <CardContent>

              {pdfUrl ? (
                <>
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    <iframe 
                      src={pdfUrl} 
                      className="w-full h-[80vh]"
                      title="Generated Receipt"
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <a 
                      href={pdfUrl} 
                      download={`donation-receipt-${formData.receiptNumber}.pdf`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      Download PDF
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">Generate a receipt to see the preview</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-medium">Note:</p>
            <p className="mt-1">This is a preview. When a donation is approved in the system, a receipt will be automatically generated with the same layout and saved to the secure storage.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
