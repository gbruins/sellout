import { createClient } from '@supabase/supabase-js'

// A dedicated Supabase client used ONLY for the service-status Realtime subscription — this
// storefront has no Supabase Auth concept at all (it authenticates to the API via a per-tenant
// API key, not a user identity — see CLAUDE.md). Auth is the server-signed token from
// POST /services/next/realtime-token, supplied through supabase-js's `accessToken` option —
// NOT a bare `realtime.setAuth(jwt)`. Without the option, supabase-js wires Realtime to its own
// callback, which (with no GoTrue session) returns the anon key; realtime-js re-reads that
// callback on every heartbeat (~25s), overriding a manual `setAuth(jwt)`. The channel stays
// joined but RLS then runs as `anon`, `storefront_realtime_select` matches nothing, and no
// change events arrive. Mirrors strawberry-admin's kitchenRealtime.ts.
let client: ReturnType<typeof createClient> | null = null
let token: string | null = null

export function getServiceRealtimeClient() {
    if (!client) {
        client = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            { accessToken: async () => token ?? import.meta.env.VITE_SUPABASE_ANON_KEY },
        )
    }

    return client
}

/** Sets the Realtime JWT and pushes it to any already-joined channels. */
export function setServiceRealtimeToken(jwt: string | null) {
    token = jwt
    // No-arg setAuth() re-reads the accessToken callback above and sends the new token.
    return getServiceRealtimeClient().realtime.setAuth()
}
