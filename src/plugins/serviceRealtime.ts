import { createClient } from '@supabase/supabase-js'

// A dedicated Supabase client used ONLY for the service-status Realtime subscription — this
// storefront has no Supabase Auth concept at all (it authenticates to the API via a per-tenant
// API key, not a user identity — see CLAUDE.md), so there's no session to isolate this from,
// but the pattern mirrors strawberry-admin's kitchenRealtime.js: auth for this client is set
// per-connection via `realtime.setAuth(jwt)` with the server-signed token from
// POST /services/next/realtime-token, never via Supabase's own sign-in flow.
let client: ReturnType<typeof createClient> | null = null

export function getServiceRealtimeClient() {
    if (!client) {
        client = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
    }

    return client
}
