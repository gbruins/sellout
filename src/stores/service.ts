import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { api, type ServiceMenu, type ServiceState, type ServiceStatus, type ServiceWindow, type Shop } from '@/api'
import { getServiceRealtimeClient } from '@/plugins/serviceRealtime'
import { DEFAULT_SHOP_TIME_ZONE } from '@/utils/shopTime'

// Fallback cadence when Realtime isn't available (no realtime_jwt — e.g. SUPABASE_JWT_SECRET
// not configured server-side — or the channel dropped). Good enough to keep the storefront
// correct without it; see strawberry-server/CLAUDE.md for why this degrades rather than
// failing outright.
const POLL_INTERVAL_MS = 5000
// How often a polling-fallback customer retries upgrading back to Realtime. Much shorter than
// the kitchen board's 45-minute token refresh — that's sized for a multi-hour shift, this is
// sized for a single browsing session.
const REALTIME_RETRY_MS = 60 * 1000
// `tenant_service_activity` can receive several writes in quick succession (e.g. a few cart
// items reserved back-to-back during checkout) — coalesce into one refetch instead of one per event.
const REFETCH_DEBOUNCE_MS = 400

export type { MenuProduct, ServiceMenu, ServiceState, ServiceStatus, ServiceWindow, Shop } from '@/api'

export const useServiceStore = defineStore('service', () => {
    // null until the first response arrives — never read that as "closed"
    const status = ref<ServiceStatus | null>(null)
    const timezone = ref<string>(DEFAULT_SHOP_TIME_ZONE)
    const service = ref<ServiceWindow | null>(null)
    const remaining = ref(0)
    const menu = ref<ServiceMenu | null>(null)
    const nextService = ref<ServiceWindow | null>(null)
    const shop = ref<Shop | null>(null)
    const loading = ref(false)
    const error = ref(false)
    // True while the live stream is down, so the shown data may be out of date
    const stale = ref(false)
    // Server time minus device time, so a wrong device clock does not matter
    const serverOffsetMs = ref(0)

    const total = computed(() => service.value?.inventory_count ?? 0)

    const now = () => new Date(Date.now() + serverOffsetMs.value)

    function apply(state: ServiceState) {
        serverOffsetMs.value = new Date(state.server_now).getTime() - Date.now()
        status.value = state.status
        timezone.value = state.timezone || DEFAULT_SHOP_TIME_ZONE
        service.value = state.service
        remaining.value = state.remaining ?? 0
        menu.value = state.menu ?? null
        nextService.value = state.next_service
        shop.value = state.shop ?? null
    }

    async function load() {
        loading.value = true
        try {
            apply(await api.service.getNext())
            error.value = false
        } catch {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    const retry = load

    let channel: RealtimeChannel | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let realtimeRetryTimer: ReturnType<typeof setInterval> | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let connecting = false
    // Set just before intentionally tearing the channel down, so its own status callback
    // (which fires with 'CLOSED' as part of that same teardown) doesn't treat it as a drop.
    let intentionalClose = false
    let boundaryTimer: ReturnType<typeof setTimeout> | null = null

    function clearBoundaryTimer() {
        if(boundaryTimer) {
            clearTimeout(boundaryTimer)
            boundaryTimer = null
        }
    }

    // Fallback for when the stream is down: refetch when the window starts or ends.
    // Display only. The server decides whether ordering is allowed.
    function scheduleBoundary() {
        clearBoundaryTimer()

        const target = status.value === 'upcoming' ? service.value?.start_at : service.value?.end_at
        if(!target) {
            return
        }

        const delay = new Date(target).getTime() - now().getTime()
        if(delay <= 0) {
            return
        }

        // setTimeout cannot hold delays beyond about 24 days
        boundaryTimer = setTimeout(async () => {
            await load()
            scheduleBoundary()
        }, Math.min(delay + 500, 2 ** 31 - 1))
    }

    function stopPolling() {
        if(pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
        }
    }

    // markStale: true only when an already-live channel just dropped — matches the original
    // SSE code's exact semantics (stale meant "a previously-open stream just closed", never
    // "we're merely attempting to connect"). Falling back to polling because no token was ever
    // available (e.g. SUPABASE_JWT_SECRET unset) is a silent degradation, not a user-facing
    // problem — polling on its own keeps the data correct, just less instantly.
    function startPolling(markStale = false) {
        stopPolling()
        if(markStale) {
            stale.value = true
        }
        pollTimer = setInterval(load, POLL_INTERVAL_MS)
    }

    function debouncedRefetch() {
        if(debounceTimer) {
            clearTimeout(debounceTimer)
        }

        debounceTimer = setTimeout(load, REFETCH_DEBOUNCE_MS)
    }

    // Realtime is only ever a "something changed, refetch" signal — never a data source itself.
    // tenant_service_activity has nothing in it but a tenant id and a timestamp (deliberately:
    // the real state is computed server-side from carts/cart_items, which hold customer PII
    // that must never reach an anonymous storefront client over Realtime).
    async function startRealtime() {
        if(connecting || channel) {
            return
        }

        connecting = true

        let token: { realtime_jwt?: string | null; tenant_id?: string } | undefined
        try {
            token = await api.service.getRealtimeToken()
        } catch {
            token = undefined
        }

        connecting = false

        if(!token?.realtime_jwt || !token.tenant_id) {
            startPolling()
            return
        }

        stopPolling()

        const client = getServiceRealtimeClient()
        client.realtime.setAuth(token.realtime_jwt)

        channel = client
            .channel(`service-activity-${token.tenant_id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tenant_service_activity', filter: `tenant_id=eq.${token.tenant_id}` },
                debouncedRefetch,
            )
            .subscribe((status) => {
                if(status === 'SUBSCRIBED') {
                    stale.value = false
                } else if(status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    channel = null

                    if(intentionalClose) {
                        return
                    }

                    // Don't trust a resumed channel to have delivered everything missed while
                    // disconnected — re-fetch rather than relying on the stream alone.
                    load()
                    startPolling(true)
                }
            })
    }

    function connect() {
        if(channel || pollTimer || connecting) {
            return
        }

        intentionalClose = false
        startRealtime()
        realtimeRetryTimer = setInterval(() => {
            if(!channel) {
                startRealtime()
            }
        }, REALTIME_RETRY_MS)

        scheduleBoundary()
    }

    function disconnect() {
        intentionalClose = true

        if(channel) {
            getServiceRealtimeClient().removeChannel(channel)
            channel = null
        }

        stopPolling()

        if(realtimeRetryTimer) {
            clearInterval(realtimeRetryTimer)
            realtimeRetryTimer = null
        }

        if(debounceTimer) {
            clearTimeout(debounceTimer)
            debounceTimer = null
        }

        clearBoundaryTimer()
    }

    // Mobile browsers freeze background tabs and drop sockets without telling the channel.
    // Coming back to the tab refetches, and re-establishes Realtime if it was lost.
    function resume() {
        if(!realtimeRetryTimer) {
            return
        }

        load()
        if(!channel) {
            startRealtime()
        }
    }

    return { stale, connect, disconnect, resume, status, timezone, shop, service, remaining, menu, nextService, loading, error, serverOffsetMs, total, now, load, retry }
})
