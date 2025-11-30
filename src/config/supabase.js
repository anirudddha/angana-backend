// ===== THIS FILE IS DEPRECATED - SUPABASE REPLACED WITH NEONDB =====
// This configuration is no longer used as we've migrated to NeonDB (PostgreSQL)
// Database connections are now handled directly through Prisma
// See prisma/schema.prisma for database configuration
//
// Previous Supabase configuration (commented out):
//
// import { createClient } from '@supabase/supabase-js';
// import dotenv from 'dotenv';
//
// dotenv.config();
//
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
//
// // Use the service_role key for backend operations
// export const supabase = createClient(supabaseUrl, supabaseKey, {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false
//   }
// });