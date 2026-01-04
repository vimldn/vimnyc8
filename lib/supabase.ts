import 'server-only'
import { createClient } from '@supabase/supabase-js'

// IMPORTANT:
// - Do NOT hardcode keys in the repo.
// - Prefer server-only env vars for API routes.
//
// Supported env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (recommended for server/API)
//   SUPABASE_ANON_KEY (ok if your RLS policies allow the needed operations)
//
// (Fallbacks for convenience in dev)
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export type Review = {
  id: string
  bbl: string
  rating: number
  title: string | null
  review: string
  pros: string | null
  cons: string | null
  lived_here: boolean
  years_lived: string | null
  author_name: string
  helpful_count: number
  created_at: string
}
