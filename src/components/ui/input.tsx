import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// List of attributes that might be added by browser extensions and cause hydration issues
const IGNORED_ATTRIBUTES = [
  'fdprocessedid',
  'data-*', // This is a pattern, actual implementation below will handle all data-* attributes
];

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    // Filter out attributes that might cause hydration issues
    const filteredProps = Object.entries(props).reduce((acc, [key, value]) => {
      // Skip attributes that match our ignore list
      if (IGNORED_ATTRIBUTES.some(attr => 
        attr.endsWith('*') ? 
          key.startsWith(attr.replace('*', '')) : 
          key === attr
      )) {
        return acc;
      }
      return { ...acc, [key]: value };
    }, {});
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...filteredProps}
        // Ensure these attributes are not overridden by props
        suppressHydrationWarning={true}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
