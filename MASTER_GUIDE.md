# Master Guide: Authentication and Role System

## Overview
This document provides comprehensive documentation for the authentication system, including session management, role-based access control, and security features. The system is built with Next.js, TypeScript, and Supabase, following security best practices.

## Core Principles

1. **Single Source of Truth**: Centralized authentication through `SessionService`
2. **Server-Side Protection**: All authentication and authorization happen on the server
3. **Role-Based Access Control (RBAC)**: Hierarchical role system with fine-grained permissions
4. **Secure Session Management**: HTTP-only, secure cookies with CSRF protection
5. **Type Safety**: Full TypeScript support with strict typing

## Authentication System Architecture

### 1. Session Management

#### SessionService
Centralized management of user sessions with the following features:
- Secure cookie management (httpOnly, secure, sameSite)
- CSRF protection with token rotation
- Cross-tab synchronization
- Automatic session cleanup
leverage SUPABSE SESSION MANAgement stystem

```typescript
// Key methods
interface SessionService {
  // Session management
  createSession(user: User): Promise<Session>;
  validateSession(sessionId: string): Promise<SessionUser>;
  invalidateSession(sessionId: string): Promise<void>;
  
  // CSRF protection
  generateCsrfToken(): string;
  validateCsrfToken(token: string): Promise<boolean>;
  
  // Token management
  rotateTokens(sessionId: string): Promise<TokenSet>;
}
```

### 2. Role & Permission Management

#### RoleService
Manages role hierarchy and permissions:
- Hierarchical role system
- Default role assignment
- Permission checking

```typescript
// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  'viewer': 1,
  'volunteer': 2,
  'donor': 3,
  'member  ': 4
  'admin  ': 5
'superadmin

};

// Example usage
const hasAccess = roleService.hasRole(userRoles, 'admin');
const canEdit = roleService.hasPermission(userPermissions, 'document:edit');
```

### 3. Middleware System

#### Authentication Middleware
```typescript
// Protect route with authentication
export const GET = withAuth(async (req) => {
  const { user } = req;
  return NextResponse.json({ user });
});

// Role-based access control
export const POST = withRoles(['admin'])(async (req) => {
  // Only accessible by admins
});
```

#### Security Features
- **CSRF Protection**: Required for all state-changing requests
- **Rate Limiting**: Applied to authentication endpoints
- **Input Validation**: All inputs are validated and sanitized

### 4. Client-Side Integration

#### Session Context
```tsx
// _app.tsx
export default function App({ Component, pageProps }) {
  return (
    <SessionProvider>
      <Component {...pageProps} />
    </SessionProvider>
  );
}

// useSession hook
const { user, loading, error } = useSession();
```

### 5. Security Best Practices

1. **Cookies**:
   - httpOnly: true
   - secure: process.env.NODE_ENV === 'production'
   - sameSite: 'lax'
   - Path and domain restrictions

2. **CSRF Protection**:
   - Token in custom header
   - Token rotation after use
   - Same-site cookie policy

3. **Rate Limiting**:
   - 5 requests per minute for auth endpoints
   - IP-based tracking
   - Exponential backoff for retries

### 6. Testing & Validation

#### Unit Tests
```typescript
describe('SessionService', () => {
  it('should validate session', async () => {
    const session = await sessionService.createSession(testUser);
    const user = await sessionService.validateSession(session.id);
    expect(user).toBeDefined();
  });
});
```

#### Integration Tests
```typescript
describe('Auth API', () => {
  it('should protect routes with valid session', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
  });
});
```

## Known Limitations & Roadmap

### Medium Priority
- Implement database role hierarchy
- Add fine-grained permissions
- Implement request batching
- Improve documentation

### Low Priority
- Dynamic role management
- WebSocket session invalidation
- Enhanced logging and monitoring

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Environment variables configured

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests

## Project Structure

```
.
├── pages/
│   ├── admin.tsx         # Admin dashboard (protected)
│   ├── dashboard.tsx     # User dashboard (protected)
│   ├── signin.tsx        # Sign-in page
│   └── signup.tsx        # Sign-up page
├── src/
│   ├── lib/
│   │   └── auth-utils.ts # Authentication utilities
│   ├── hooks/
│   │   └── useUser.ts    # User context and hooks
│   └── middleware/       # Server middleware
└── server.ts             # Express server
```

## Authentication Flow

1. **User Signs In/Up**
   - Credentials are sent to `/auth/login` or `/auth/signup`
   - Server validates credentials and creates a session
   - HTTP-only cookie is set with the session token

2. **Protected Route Access**
   - Browser makes request with cookies
   - `getServerSideProps` calls `/auth/me` to verify session
   - User data is passed as props if authenticated
   - Unauthorized users are redirected to sign-in

3. **Role-Based Access**
   - User roles are checked on the server
   - Protected routes can specify required roles
   - Unauthorized access attempts are redirected

## Core Components

### 1. Authentication Utilities (`src/lib/auth-utils.ts`)

Centralized authentication logic for server-side checks.

#### Features:
- Session validation
- Role-based access control
- Automatic redirects for unauthenticated/unauthorized users
- Type-safe user data

#### Usage:
```typescript
// Protect a page with authentication
export const getServerSideProps = withAuth();

// Protect with specific role
export const getServerSideProps = withAuth(undefined, {
  roles: ['admin'],
  redirectTo: '/unauthorized'
});
```

### 2. User Hook (`src/hooks/useUser.ts`)

Manages user state on the client side.

#### Features:
- Fetches user data on mount
- Handles authentication state
- Provides loading states
- Type-safe user data

#### Usage:
```typescript
const { user, loading } = useUser({
  redirectTo: '/signin',
  redirectIfFound: false
});
```

## Best Practices

1. **Always use `getServerSideProps` for protected pages**
2. **Never store sensitive data in client-side state**
3. **Use the `useUser` hook for client-side user data**
4. **Define role requirements at the page level**
5. **Keep authentication logic centralized**

## Security Considerations

- HTTP-only cookies for session management
- CSRF protection on all routes
- Secure cookie settings (httpOnly, secure, sameSite)
- Rate limiting on authentication endpoints
- Input validation on all user inputs

// Admin client (for server-side operations)
const { data: adminData } = await supabaseAdmin
  .rpc('admin_function');
```

### 2. Session Management (`lib/sessionManager.js`)

Centralized session and CSRF protection.

#### Features:
- Secure session configuration
- CSRF protection
- Cookie security settings
- Error handling

#### Middleware Setup:
```javascript
import { sessionMiddleware, csrfMiddleware } from '../lib/sessionManager';

// Apply session middleware
app.use(sessionMiddleware);

// Apply CSRF protection
app.use(csrfMiddleware);
```

#### CSRF Protection:
- Automatically validates CSRF tokens for non-GET requests
- Exposes CSRF token via `XSRF-TOKEN` cookie
- Handles CSRF errors with appropriate responses

#### Session Configuration:
- HTTP-only cookies
- Secure flag in production
- 24-hour session expiration
- Rolling sessions
- SameSite cookie policy

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm (comes with Node.js)
- Supabase account and project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Update `.env` with your Supabase credentials

### Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Lint your code

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Server
NODE_ENV=development
PORT=3001
SESSION_SECRET=your_session_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# CORS
CLIENT_URL=http://localhost:3000
```

### Security Considerations

1. **Session Security**
   - Always use HTTPS in production
   - Keep `SESSION_SECRET` secure and never commit it to version control
   - Rotate session secrets periodically

2. **CSRF Protection**
   - All non-GET requests require a valid CSRF token
   - Tokens are automatically managed via cookies
   - Frontend should include the token in request headers:
     ```javascript
     // Example: Sending CSRF token with fetch
     fetch('/api/endpoint', {
       method: 'POST',
       credentials: 'include',
       headers: {
         'Content-Type': 'application/json',
         'X-CSRF-Token': getCookie('XSRF-TOKEN')
       },
       body: JSON.stringify(data)
     });
     ```

3. **CORS**
   - Configured to only allow requests from `CLIENT_URL`
   - Credentials are included for cross-origin requests

## Database Schema

### Tables

#### 1. `profiles`
Stores extended user profile information.

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| user_id | UUID | Yes | Primary key, references auth.users.id |
| email | TEXT | Yes | User's email address |
| full_name | TEXT | Yes | User's full name |
| phone_number | TEXT | No | Contact number |
| cnic_number | TEXT | No | National ID number |
| cnic_front | TEXT | No | URL to front of CNIC in storage |
| cnic_back | TEXT | No | URL to back of CNIC in storage |
| address | JSONB | No | Structured address information |
| date_of_birth | DATE | No | User's date of birth |
| gender | TEXT | No | User's gender |
| emergency_contact_name | TEXT | No | Emergency contact name |
| emergency_contact_number | TEXT | No | Emergency contact number |
| verification_status | TEXT | Yes | Account verification status |
| created_at | TIMESTAMPTZ | Yes | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Record last update timestamp |

#### 2. `user_roles`
Manages user role assignments and basic user information for quick access.

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| user_id | UUID | Yes | Primary key, references auth.users.id |
| email | TEXT | Yes | User's email (denormalized from profiles) |
| full_name | TEXT | Yes | User's full name (denormalized from profiles) |
| is_admin | BOOLEAN | No | Administrator privileges |
| is_donor | BOOLEAN | No | Donor role |
| is_volunteer | BOOLEAN | No | Volunteer role |
| is_member | BOOLEAN | No | Member role |
| is_viewer | BOOLEAN | No | Basic view-only access |
| created_at | TIMESTAMPTZ | Yes | When the role was created |
| updated_at | TIMESTAMPTZ | Yes | When the role was last updated |

## Storage
- **Bucket**: `cnic_docs`
  - Stores CNIC documents
  - Private access only
  - Files organized by user ID

## Security

### Row Level Security (RLS)
- **Profiles Table**
  - Users can only view and update their own profile
  - No deletion allowed through API

- **User Roles Table**
  - Users can view their own roles
  - Only admins can update roles
  - No deletion allowed through API

### Storage Security
- CNIC documents are stored securely with access restricted to the owner
- All file operations are validated against the user's permissions

## RPC Functions

### 1. Authentication & Authorization
1. `get_user_roles(user_id UUID) → JSONB`
   - Returns all roles for the specified user
   - Example: `{ "is_admin": true, "is_donor": false, ... }`

2. `has_permission(user_id UUID, action TEXT) → BOOLEAN`
   - Checks if a user has permission to perform an action
   - Returns true/false
   - Permission mapping:
     - `access_admin_dashboard` → Requires `is_admin = true`
     - `manage_users` → Requires `is_admin = true`
     - `view_donor_portal` → Requires `is_donor = true`
     - `make_donation` → Requires `is_donor = true`
     - `view_volunteer_portal` → Requires `is_volunteer = true`
     - `manage_volunteer_hours` → Requires `is_volunteer = true`
     - `view_member_portal` → Requires `is_member = true`
     - `access_member_resources` → Requires `is_member = true`
     - `view_public_content` → Available to all authenticated users

### 2. Helper Functions
1. `is_admin() → BOOLEAN`
   - Checks if current user is an admin
   - Example: `SELECT is_admin();`

2. `my_roles() → JSONB`
   - Returns current user's roles
   - Example: `SELECT my_roles();`

3. `can_i(action TEXT) → BOOLEAN`
   - Checks if current user has a specific permission
   - Example: `SELECT can_i('access_admin_dashboard');`

### 3. System Functions
1. `update_updated_at_column()`
   - Updates the `updated_at` timestamp on profile update

2. `update_user_roles_updated_at()`
   - Updates the `updated_at` timestamp on user_roles update

3. `handle_new_user()`
   - Creates profile and role entries for new users
   - Sets default viewer role
   - Synchronizes email and full_name to user_roles

4. `sync_user_roles_profile()`
   - Keeps user_roles in sync with profile updates
   - Updates email and full_name when profiles change

## Triggers

### 1. Profile Triggers
- `update_profiles_updated_at`
  - Updates `updated_at` on profile changes
  - Ensures data consistency

- `sync_user_roles_after_profile_update`
  - Syncs profile changes to user_roles
  - Updates email and full_name when profiles change

### 2. User Roles Triggers
- `update_user_roles_updated_at`
  - Updates `updated_at` on user_roles changes
  - Maintains audit trail

### 3. Authentication Triggers
- `on_auth_user_created`
  - Handles new user registration
  - Creates profile and role entries
  - Sets up default permissions

## Best Practices

### API Documentation

### Authentication

#### Sign In
```typescript
POST /auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

// Response
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "roles": {
      "is_admin": false,
      "is_donor": true,
      "is_volunteer": false,
      "is_member": true,
      "is_viewer": true
    }
  }
}
```

#### Sign Out
```typescript
POST /auth/signout

// Response
{
  "message": "Successfully signed out"
}
```

#### Get Current User
```typescript
GET /auth/me

// Response
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "roles": {
      "is_admin": false,
      "is_donor": true,
      "is_volunteer": false,
      "is_member": true,
      "is_viewer": true
    }
  }
}
```

### Protected Routes

#### Admin Dashboard (Requires admin role)
```typescript
GET /api/admin/dashboard

// Response (for admin)
{
  "message": "Welcome to the admin dashboard"
}

// Error (non-admin)
{
  "error": "Insufficient permissions",
  "requiredRoles": ["is_admin"]
}
```

#### Create Donation (Requires permission)
```typescript
POST /api/donations
Content-Type: application/json

{
  "amount": 1000,
  "donor_id": "donor-uuid",
  "campaign_id": "campaign-uuid"
}

// Response
{
  "donation": {
    "id": "donation-uuid",
    "amount": 1000,
    "donor_id": "donor-uuid",
    "campaign_id": "campaign-uuid",
    "status": "completed",
    "created_at": "2025-08-29T16:30:00Z"
  }
}
```

### Public Routes

#### List Active Campaigns
```typescript
GET /api/campaigns

// Response
{
  "campaigns": [
    {
      "id": "campaign-1",
      "title": "Education Fund",
      "description": "Support children's education",
      "target_amount": 100000,
      "current_amount": 45000,
      "is_active": true
    }
  ]
}
```

## TypeScript Types

### User Roles Interface
```typescript
interface UserRoles {
  is_admin: boolean;
  is_donor: boolean;
  is_volunteer: boolean;
  is_member: boolean;
  is_viewer: boolean;
}
```

### Request with User
```typescript
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      userRoles?: UserRoles;
      userId?: string;
    }
  }
}
```

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=3001
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# CORS
CLIENT_URL=http://localhost:3000
```

## Error Handling

The API returns standardized error responses:

```typescript
// 400 Bad Request
{
  "error": "Validation Error",
  "message": "Email and password are required"
}

// 401 Unauthorized
{
  "error": "Authentication required"
}

// 403 Forbidden
{
  "error": "Insufficient permissions",
  "requiredRoles": ["is_admin"]
}

// 500 Internal Server Error
{
  "error": "Internal Server Error",
  "message": "Failed to process request"
}
```

## Security Best Practices

1. **Environment Variables**: Never commit sensitive data to version control
2. **CSRF Protection**: All state-changing operations require CSRF tokens
3. **Rate Limiting**: Implement rate limiting in production
4. **CORS**: Configure allowed origins properly
5. **Input Validation**: Validate all user inputs
6. **HTTPS**: Always use HTTPS in production
7. **Session Security**: Use secure and httpOnly cookies
8. **Dependencies**: Keep all dependencies up to date

### Frontend Integration
```typescript
// Get current user's roles
const { data: roles } = await supabase.rpc('my_roles');

// Check specific permission
const { data: canAccess } = await supabase.rpc('can_i', {
  action: 'access_admin_dashboard'
});

// Check if admin
const { data: isAdmin } = await supabase.rpc('is_admin');
```

### Backend Usage
```sql
-- In a stored procedure or RLS policy
IF NOT public.has_permission(auth.uid(), 'manage_users') THEN
  RAISE EXCEPTION 'Insufficient permissions';
END IF;
```

### Security Notes
- All RPC functions are `SECURITY DEFINER`
- Input validation is performed on all functions
- Default deny policy: if a permission isn't explicitly granted, access is denied
- Audit logging should be added for sensitive operations
