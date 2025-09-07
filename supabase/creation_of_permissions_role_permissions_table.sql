-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_name TEXT NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_name, permission_id)
);

-- 3. Create default permissions
INSERT INTO public.permissions (name, description) VALUES
    -- Admin permissions
    ('admin:full_access', 'Full administrative access'),
    ('admin:manage_users', 'Manage user accounts and roles'),
    ('admin:view_reports', 'View system reports'),
    
    -- Donor permissions
    ('donor:create_donation', 'Create new donations'),
    ('donor:view_own_donations', 'View own donation history'),
    
    -- Volunteer permissions
    ('volunteer:manage_donations', 'Manage donation records'),
    ('volunteer:view_donors', 'View donor information'),
    
    -- Member permissions
    ('member:access_member_area', 'Access member-only content'),
    ('member:view_events', 'View member events'),
    
    -- Viewer permissions
    ('viewer:read_content', 'View public content')
ON CONFLICT (name) DO NOTHING;

-- 4. Assign permissions to roles
-- Admin gets all permissions
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Donor permissions
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'donor', id FROM public.permissions 
WHERE name LIKE 'donor:%'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Volunteer permissions
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'volunteer', id FROM public.permissions 
WHERE name LIKE 'volunteer:%' OR name LIKE 'viewer:%'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Member permissions
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'member', id FROM public.permissions 
WHERE name LIKE 'member:%' OR name LIKE 'viewer:%'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Viewer permissions (most restricted)
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'viewer', id FROM public.permissions 
WHERE name LIKE 'viewer:%'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- 5. Create the permission check function
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON (
            (ur.is_admin AND rp.role_name = 'admin') OR
            (ur.is_donor AND rp.role_name = 'donor') OR
            (ur.is_volunteer AND rp.role_name = 'volunteer') OR
            (ur.is_member AND rp.role_name = 'member') OR
            (ur.is_viewer AND rp.role_name = 'viewer')
        )
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
        AND p.name = p_permission_name
    ) INTO v_has_permission;
    
    RETURN COALESCE(v_has_permission, false);
END;
$$;

-- 6. Add RLS policies for security
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to permissions" 
ON public.permissions 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow read access to role_permissions" 
ON public.role_permissions 
FOR SELECT 
TO authenticated 
USING (true);

-- 7. Grant necessary permissions
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission TO authenticated;

-- 8. Create a view for user permissions (optional but useful)
CREATE OR REPLACE VIEW public.user_permissions AS
SELECT 
    ur.user_id,
    p.name as permission_name,
    p.description as permission_description,
    CASE 
        WHEN ur.is_admin THEN 'admin'
        WHEN ur.is_donor THEN 'donor'
        WHEN ur.is_volunteer THEN 'volunteer'
        WHEN ur.is_member THEN 'member'
        WHEN ur.is_viewer THEN 'viewer'
    END as role_name
FROM 
    public.user_roles ur
CROSS JOIN LATERAL (
    SELECT rp.role_name, p.name, p.description
    FROM public.role_permissions rp
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE (ur.is_admin AND rp.role_name = 'admin') OR
          (ur.is_donor AND rp.role_name = 'donor') OR
          (ur.is_volunteer AND rp.role_name = 'volunteer') OR
          (ur.is_member AND rp.role_name = 'member') OR
          (ur.is_viewer AND rp.role_name = 'viewer')
) p;

-- 9. Create a function to get all permissions for a user (useful for JWT claims)
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT jsonb_agg(DISTINCT p.name)
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON (
        (ur.is_admin AND rp.role_name = 'admin') OR
        (ur.is_donor AND rp.role_name = 'donor') OR
        (ur.is_volunteer AND rp.role_name = 'volunteer') OR
        (ur.is_member AND rp.role_name = 'member') OR
        (ur.is_viewer AND rp.role_name = 'viewer')
    )
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions TO authenticated;