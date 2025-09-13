import { createClient as createServerClient } from './supabase/server';

// Create a server client instance
const supabaseServerClient = createServerClient();

// Export the server client
export { supabaseServerClient as supabase };

// For backward compatibility, export a getter function
export const getServerSupabaseClient = () => createServerClient();