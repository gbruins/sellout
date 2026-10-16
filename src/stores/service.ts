import { computed, inject, ref } from 'vue'
import { defineStore } from 'pinia'

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
    const api = inject<any>('$api')

    const status = ref<ServiceStatus | null>(null)
    const service = ref<ServiceWindow | null>(null)
    const remaining = ref(0)
    const menu = ref<ServiceMenu | null>(null)
    const nextService = ref<ServiceWindow | null>(null)
    const loading = ref(false)
    const error = ref(false)
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

    return { status, service, remaining, menu, nextService, loading, error, serverOffsetMs, total, now, apply, load, retry }
})
