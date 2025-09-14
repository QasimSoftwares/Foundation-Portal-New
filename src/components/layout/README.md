# Layout System

This directory contains the layout components that provide consistent styling and structure across the application.

## Components

### `PageLayout`

The main layout component that should wrap all pages. It provides:
- Top navigation bar
- Sidebar (optional)
- Consistent spacing and styling
- Authentication state handling

#### Usage

```tsx
import { PageLayout } from '@/components/layout/PageLayout';

export default function MyPage() {
  return (
    <PageLayout>
      {/* Your page content */}
      <h1>My Page</h1>
    </PageLayout>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showSidebar` | boolean | `true` | Whether to show the sidebar |
| `contentClassName` | string | `''` | Additional classes for the main content area |
| `requireAuth` | boolean | `true` | Whether the page requires authentication |

## Styling Guidelines

### Spacing
- Use Tailwind's spacing scale (p-4, m-2, etc.)
- Main content area has `p-4 lg:p-5` padding
- Max width of content is `max-w-7xl` with `mx-auto`

### Colors
- Background: `bg-gray-50`
- Cards: `bg-white` with `shadow-sm` and `rounded-lg`
- Borders: `border border-gray-200`

### Typography
- Use Inter font family (applied in root layout)
- Headings: Use semantic HTML (`h1`, `h2`, etc.) with appropriate font weights
- Text: Use Tailwind's text utilities for size and color

## Creating New Pages

1. Create a new page in the `app` directory
2. Import and use the `PageLayout` component
3. Add your page-specific content inside the layout

```tsx
import { PageLayout } from '@/components/layout/PageLayout';

export default function NewPage() {
  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
          <p className="mt-1 text-sm text-gray-600">Page description or subtitle</p>
        </div>
        
        {/* Page content */}
      </div>
    </PageLayout>
  );
}
```
