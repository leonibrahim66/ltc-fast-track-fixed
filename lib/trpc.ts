/**
 * tRPC Compatibility Module
 * 
 * This module has been deprecated in favor of Supabase.
 * All API calls should be migrated to use Supabase directly.
 * 
 * For authentication: Use @/lib/supabase-auth
 * For database queries: Use @/lib/supabase-db
 * For client initialization: Use @/lib/supabase
 */

export { trpc, createTRPCClient } from "./trpc-stub";
