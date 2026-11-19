import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const backendConfigured = !!(url && key)
if (!backendConfigured) console.warn('Supabase env vars missing: running in offline test mode (demo logins only).')

// Placeholders keep the app from crashing with a blank page when no backend is configured yet.
export const supabase = createClient(url || 'http://localhost:54321', key || 'offline-test-key')
