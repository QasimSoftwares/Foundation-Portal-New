import { useToast } from './use-toast';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'destructive';

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-white border-gray-200',
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
  destructive: 'bg-red-50 border-red-200',
};

const variantIcons: Record<ToastVariant, string> = {
  default: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  destructive: '❌',
};

interface ToastProps {
  toast: {
    id: string;
    title: string;
    description?: string;
    variant?: ToastVariant;
  };
  onDismiss: (id: string) => void;
}

const Toast = ({ toast, onDismiss }: ToastProps) => {
  const variant = toast.variant || 'default';
  
  return (
    <div
      className={`flex items-center p-4 rounded-lg shadow-md border ${variantStyles[variant as ToastVariant]}`}
    >
      <span className="mr-2 text-lg">
        {variantIcons[variant as ToastVariant]}
      </span>
      <div>
        <h4 className="font-medium">{toast.title}</h4>
        {toast.description && (
          <p className="text-sm text-gray-600">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-gray-500 hover:text-gray-700"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast 
          key={toast.id} 
          toast={{
            id: toast.id,
            title: typeof toast.title === 'string' ? toast.title : 'Notification',
            description: typeof toast.description === 'string' ? toast.description : undefined,
            variant: toast.variant || 'default'
          }}
          onDismiss={dismiss} 
        />
      ))}
    </div>
  );
}
