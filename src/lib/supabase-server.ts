import { createServerClient } from './supabaseClient';

// Create a server client instance
const supabaseServerClient = createServerClient();

// Export the server client
export { supabaseServerClient as supabase };

// For backward compatibility
export { createServerClient };