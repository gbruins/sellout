import { computed, inject, ref } from 'vue'
import { defineStore } from 'pinia'
import { openServiceStream } from '@/utils/serviceStream'

export type ServiceStatus = 'open' | 'sold_out' | 'upcoming' | 'none'

export interface ServiceWindow {
    id: string
    start_at: string
    end_at: string
    notes: string | null
    inventory_count: number
    max_per_order: number
}

export interface MenuProduct {
    id: string
    title: string
    description: string | null
    base_price: number | null
}

export interface ServiceMenu {
    id: string
    title: string
    description: string | null
    products: MenuProduct[]
}

export interface ServiceState {
    status: ServiceStatus
    server_now: string
    service: ServiceWindow | null
    remaining?: number
    menu?: ServiceMenu | null
    next_service: ServiceWindow | null
}

export const useServiceStore = defineStore('service', () => {
    const api = inject<Record<string, any>>('$api') // eslint-disable-line @typescript-eslint/no-explicit-any

    const status = ref<ServiceStatus | null>(null)
    const service = ref<ServiceWindow | null>(null)
    const remaining = ref(0)
    const menu = ref<ServiceMenu | null>(null)
    const nextService = ref<ServiceWindow | null>(null)
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
        service.value = state.service
        remaining.value = state.remaining ?? 0
        menu.value = state.menu ?? null
        nextService.value = state.next_service
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

    let stopStream: (() => void) | null = null
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

    function receive(state: ServiceState) {
        apply(state)
        error.value = false
        stale.value = false
        scheduleBoundary()
    }

    function connect() {
        if(stopStream) {
            return
        }

        const baseURL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
        const apiUser = import.meta.env.VITE_API_USER || 'store'
        const apiKey = import.meta.env.VITE_API_KEY

        stopStream = openServiceStream(
            {
                url: `${baseURL}/services/next/stream`,
                headers: apiKey ? { Authorization: `Basic ${btoa(`${apiUser}:${apiKey}`)}` } : undefined,
            },
            {
                onState: receive,
                onDisconnected: () => {
                    stale.value = true
                },
            },
        )

        scheduleBoundary()
    }

    function disconnect() {
        stopStream?.()
        stopStream = null
        clearBoundaryTimer()
    }

    return { stale, connect, disconnect, receive, status, service, remaining, menu, nextService, loading, error, serverOffsetMs, total, now, apply, load, retry }
})
