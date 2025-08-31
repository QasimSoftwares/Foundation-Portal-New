import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="mt-6">
          <Button
            onClick={resetErrorBoundary}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
