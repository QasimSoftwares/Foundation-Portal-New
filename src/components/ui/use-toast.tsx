import React, { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type UseToastReturn = {
  toasts: Toast[];
  showToast: (props: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => string;
  removeToast: (id: string) => void;
};

let globalToasts: Toast[] = [];
let updateCallbacks: Array<() => void> = [];

function notifyUpdate() {
  updateCallbacks.forEach(cb => cb());
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  // Register update callback
  React.useEffect(() => {
    updateCallbacks.push(updateToasts);
    return () => {
      updateCallbacks = updateCallbacks.filter(cb => cb !== updateToasts);
    };
  }, []);

  const updateToasts = () => {
    setToasts([...globalToasts]);
  };

  const showToast = useCallback(({
    title,
    description,
    variant = 'default',
    duration = 5000,
  }: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, description, variant };
    
    globalToasts = [...globalToasts, newToast];
    notifyUpdate();

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    globalToasts = globalToasts.filter((toast) => toast.id !== id);
    notifyUpdate();
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
  };
}

// Create a singleton instance for the toast function
const toastInstance = (() => {
  let instance: ReturnType<typeof useToast> | null = null;
  
  return () => {
    if (!instance) {
      // This is a workaround to create a single instance
      // In a real app, you might want to use a proper state management solution
      instance = {
        toasts: [],
        showToast: (props) => {
          const id = Math.random().toString(36).substring(2, 9);
          const newToast = {
            id,
            title: props.title,
            description: props.description,
            variant: props.variant || 'default',
          };
          
          globalToasts = [...globalToasts, newToast];
          notifyUpdate();

          if (props.duration !== 0) {
            const duration = props.duration || 5000;
            setTimeout(() => {
              globalToasts = globalToasts.filter(t => t.id !== id);
              notifyUpdate();
            }, duration);
          }

          return id;
        },
        removeToast: (id: string) => {
          globalToasts = globalToasts.filter((toast) => toast.id !== id);
          notifyUpdate();
        },
      };
    }
    return instance;
  };
})();

export const toast = {
  success: (title: string, description?: string) => 
    toastInstance().showToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    toastInstance().showToast({ title, description, variant: 'error' }),
  warning: (title: string, description?: string) =>
    toastInstance().showToast({ title, description, variant: 'warning' }),
  info: (title: string, description?: string) =>
    toastInstance().showToast({ title, description, variant: 'info' }),
};