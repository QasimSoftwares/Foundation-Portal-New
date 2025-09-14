import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const tabsListVariants = cva(
  'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
  {
    variants: {
      variant: {
        default: '',
        outline: 'border border-input bg-transparent',
      },
      size: {
        default: 'h-10 py-2',
        sm: 'h-9 px-2',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
  {
    variants: {
      variant: {
        default: 'data-[state=active]:bg-background data-[state=active]:text-foreground',
        outline: 'data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof tabsListVariants> {
  value: string;
  onValueChange: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, variant, size, value, onValueChange, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('space-y-4', className)}
      role="tablist"
      {...props}
    />
  )
);

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof tabsListVariants>
>(({ className, variant, size, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(tabsListVariants({ variant, size, className }))}
    role="tablist"
    {...props}
  />
));

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & 
  VariantProps<typeof tabsTriggerVariants> & {
    value: string;
    isActive?: boolean;
  }
>(({ className, variant, isActive, ...props }, ref) => (
  <button
    ref={ref}
    role="tab"
    type="button"
    className={cn(
      tabsTriggerVariants({ variant, className }),
      isActive && 'data-[state=active]'
    )}
    data-state={isActive ? 'active' : 'inactive'}
    {...props}
  />
));

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string; isActive: boolean }
>(({ className, isActive, ...props }, ref) => (
  <div
    ref={ref}
    role="tabpanel"
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      !isActive && 'hidden',
      className
    )}
    tabIndex={isActive ? 0 : -1}
    {...props}
  />
));

export { Tabs, TabsList, TabsTrigger, TabsContent };
