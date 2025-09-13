'use client';

import { useEffect, useState } from 'react';

export default function DebugRolesPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/debug-roles');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading debug information...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <pre className="bg-red-50 p-4 rounded-md text-red-700 overflow-auto">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Debug Role Information</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">User Information</h2>
        <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
          {JSON.stringify(data?.user, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">User Roles (Direct Query)</h2>
        <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
          {JSON.stringify(data?.user_roles, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">RPC Roles</h2>
        <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
          {JSON.stringify(data?.rpc_roles, null, 2)}
        </pre>
      </div>

      {data?.rpc_error && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">RPC Error</h2>
          <pre className="bg-red-50 p-4 rounded-md text-red-700 overflow-auto">
            {JSON.stringify(data.rpc_error, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h2 className="text-lg font-semibold mb-2">What to look for:</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Is the user ID correct?</li>
          <li>Are there any roles in the user_roles table?</li>
          <li>Is the RPC function returning data or an error?</li>
          <li>Are the role flags (is_admin, is_donor, etc.) set correctly?</li>
        </ul>
      </div>
    </div>
  );
}
