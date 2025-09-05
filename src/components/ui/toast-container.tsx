'use client';

import { useToast } from './use-toast';
import { useEffect, useState } from 'react';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'destructive' | null | undefined;

const variantStyles: Record<NonNullable<ToastVariant>, string> = {
  default: 'bg-white border-gray-200',
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
  destructive: 'bg-red-50 border-red-200',
};

const variantIcons: Record<NonNullable<ToastVariant>, string> = {
  default: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  destructive: '❌',
};

const getVariantStyle = (variant: ToastVariant): string => {
  return variant ? variantStyles[variant] || variantStyles.default : variantStyles.default;
};

const getVariantIcon = (variant: ToastVariant): string => {
  return variant ? variantIcons[variant] || variantIcons.default : variantIcons.default;
};

interface ToastProps {
  toast: {
    id: string;
    title?: string | React.ReactNode;
    description?: string | React.ReactNode;
    variant?: ToastVariant;
    [key: string]: unknown;
  };
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const variant = toast.variant;
  const variantStyle = getVariantStyle(variant);
  const variantIcon = getVariantIcon(variant);
  
  return (
    <div
      className={`relative flex items-start p-4 mb-2 rounded-lg border ${variantStyle} shadow-lg max-w-sm`}
      role="alert"
    >
      <span className="mr-2 text-xl">{variantIcon}</span>
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{toast.title}</h3>
        {toast.description && (
          <p className="mt-1 text-sm text-gray-600">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-gray-500 hover:text-gray-700"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [isMounted, setIsMounted] = useState(false);
  const { toasts, dismiss } = useToast();

  // This ensures the component only renders on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
