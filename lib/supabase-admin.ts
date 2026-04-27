import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}@inka.app`
}

export function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}
