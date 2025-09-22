# PERFORMANCE AUDIT REPORT (20 Sep)

This report provides a comprehensive performance audit of the web application, based on a static analysis of the codebase. It covers the frontend, backend, database, and infrastructure layers, identifying both strengths and areas for improvement.

---

### **1. Frontend Performance**

**Objective**: Audit page load times, bundle size, rendering strategies, and resource blocking.

*   **Rendering Strategy**
    *   ⚠️ **Identified Bottleneck (Overuse of Client Components)**: The primary performance issue on the frontend is the implementation of entire pages (e.g., `/admin/dashboard`, `/donor/dashboard`) as large Client Components (`"use client"`). This forces all data fetching to occur on the client-side within `useEffect` hooks.
        *   **Impact**: This pattern leads to slower perceived page loads, as the user first receives a page with loading skeletons, then waits for multiple API requests to complete before the final UI is rendered. This can negatively affect Core Web Vitals like Largest Contentful Paint (LCP).
    *   📌 **Recommendation**: Refactor key pages to leverage React Server Components (RSCs). The initial, non-interactive data should be fetched directly within the page's Server Component. This data can then be passed as props to smaller, more focused Client Components that handle interactivity (e.g., filtering, charts). This will allow the page to be server-rendered with its data, providing a much faster and more complete initial paint.

*   **Component Architecture & State Management**
    *   ✅ **Working Well**: The use of a shared `PageLayout` and reusable components like `MetricCard` is good practice and helps maintain consistency without adding significant performance overhead.
    *   ⚠️ **Identified Inefficiency (`RoleHydrator` Context)**: The `RoleHydrator` provider in the root layout may be performing client-side work to determine user roles. If this involves data fetching, it could introduce a delay or a UI flicker on initial load.
    *   📌 **Recommendation**: Ensure that essential user role information is available as early as possible, ideally embedded in the initial server-rendered payload or fetched with very high priority, to avoid layout shifts or permission-related UI flashes.

*   **Bundle Size & Resources**
    *   ✅ **Working Well**: The project uses `swcMinify: true`, which is the most efficient way to minimize JavaScript bundles in Next.js.
    *   ⚠️ **Potential Issue (`pdf-lib`)**: The `pdf-lib` dependency can be large and CPU-intensive. Its usage needs to be carefully managed.
    *   📌 **Recommendation**: If PDF generation is happening on the client-side, it should be moved to a Web Worker to avoid blocking the main thread. If it's on the server, it should be done in a non-blocking way, ideally in a separate serverless function or background job if the process is slow, to avoid delaying API responses.

---

### **2. Backend & API Calls**

**Objective**: Analyze API latency, efficiency of RPC calls, and redundant data fetching.

*   **API Architecture**
    *   ⚠️ **Identified Bottleneck (Fragmented Admin APIs)**: The admin dashboard's data fetching is highly inefficient. It makes four separate API calls to individual metric endpoints. Each call independently incurs network latency, potential cold starts, and redundant authentication/authorization checks.
    *   📌 **Recommendation**: This is the most critical performance issue found. Deprecate the separate admin metric endpoints (`/api/admin/metrics/*`, `/api/donors/metrics`) and replace them with a single, consolidated endpoint (e.g., `/api/admin/dashboard-metrics`). This new endpoint should be powered by a single, efficient RPC function that aggregates all the data on the database server.
    *   ✅ **Working Well**: In contrast, the `/api/donor/metrics` endpoint is a model of efficiency, using a single RPC to fetch all required data at once.

*   **Authentication Overhead**
    *   ⚠️ **Identified Inefficiency**: The admin API routes make repeated calls to the `is_admin` RPC. While the function itself is fast, the repetition across multiple API requests adds unnecessary overhead. This is a direct symptom of the fragmented API architecture.
    *   📌 **Recommendation**: Consolidating the admin APIs into a single endpoint will resolve this issue by reducing the number of `is_admin` checks to one per page load.

---

### **3. Database Layer**

**Objective**: Inspect query efficiency, index usage, and RPC optimization.

*   **RPC Function Efficiency**
    *   ✅ **Working Well**: The database RPC functions are generally well-written and efficient. The `donor_metrics` function, which uses CTEs to perform multiple aggregations in one query, is an excellent example of a performant database function.
    *   ⚠️ **Identified Inefficiency (By Architecture)**: The existence of multiple, fine-grained RPCs for the admin dashboard (`get_total_donations`, `get_total_donors`) encourages the inefficient multi-API-call pattern. The problem is not the functions themselves, but how they are used.
    *   📌 **Recommendation**: Create a new, consolidated RPC function named `get_admin_dashboard_metrics` that calculates all required admin metrics in a single query. This will be significantly more performant and will align the admin data fetching strategy with the already-efficient donor strategy.

*   **Indexes and RLS**
    *   ✅ **Working Well**: The queries observed in the RPCs are simple aggregations (`COUNT`, `SUM`) and joins on what appear to be foreign key relationships (e.g., `donors.user_id`). These are typically well-indexed by default in Supabase. There is no evidence that RLS policies are causing significant performance overhead.

---

### **4. Caching & State Management**

**Objective**: Evaluate server-side caching and client-side data management.

*   **Caching Strategy**
    *   ⚠️ **Identified Inefficiency**: The API routes explicitly use headers like `'Cache-Control': 'no-cache'`. While this ensures data freshness, it also means the application is not leveraging caching. For a dashboard, a short cache lifetime (e.g., 1-5 minutes) would be appropriate to reduce database load and improve API response times without serving stale data.
    *   📌 **Recommendation**: Implement a caching strategy. For the API routes, consider using `Cache-Control` headers with a `s-maxage` value to enable server-side caching on the Vercel infrastructure. For the frontend, if the pages are refactored to use Server Components, Next.js's built-in `fetch` caching can be used to cache data between deployments.

---

### **Summary of High-Impact Recommendations**

1.  **Refactor Dashboards to Use Server Components**: This is the most important frontend change. Fetch initial data on the server to dramatically improve perceived load times.
2.  **Consolidate Admin API Endpoints**: Replace the four separate admin metric APIs with a single, unified endpoint to reduce network latency and redundant server-side work.
3.  **Create a Consolidated Admin RPC**: Support the new unified API endpoint with a single database function (`get_admin_dashboard_metrics`) that aggregates all data in one query.
4.  **Implement a Caching Strategy**: Introduce short-lived caching for dashboard data to reduce database load and improve API responsiveness.
