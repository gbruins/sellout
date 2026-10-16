import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useServiceStore } from '../service'

const makeStore = (getNext: () => Promise<unknown>) => {
    const app = createApp({})
    const pinia = createPinia()
    app.use(pinia)
    app.provide('$api', { service: { getNext } })
    return app.runWithContext(() => useServiceStore())
}

const window = {
    id: 's1', start_at: '2026-10-17T19:00:00.000Z', end_at: '2026-10-18T02:00:00.000Z',
    notes: null, inventory_count: 60, max_per_order: 4,
}

describe('service store', () => {
    afterEach(() => vi.useRealTimers())

    it('maps an open state', async () => {
        const store = makeStore(async () => ({
            status: 'open', server_now: new Date().toISOString(), service: window, remaining: 41,
            menu: { id: 'm', title: 'Menu', description: null, products: [] }, next_service: null,
        }))
        await store.load()
        expect(store.status).toBe('open')
        expect(store.remaining).toBe(41)
        expect(store.total).toBe(60)
        expect(store.menu?.title).toBe('Menu')
        expect(store.error).toBe(false)
    })

    it('maps upcoming and none without remaining or menu', async () => {
        const store = makeStore(async () => ({ status: 'upcoming', server_now: new Date().toISOString(), service: window, next_service: null }))
        await store.load()
        expect(store.status).toBe('upcoming')
        expect(store.remaining).toBe(0)
        expect(store.menu).toBeNull()

        const none = makeStore(async () => ({ status: 'none', server_now: new Date().toISOString(), service: null, next_service: null }))
        await none.load()
        expect(none.status).toBe('none')
        expect(none.service).toBeNull()
    })

    it('corrects for a wrong device clock', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'))
        const store = makeStore(async () => ({ status: 'none', server_now: '2026-10-16T12:00:00.000Z', service: null, next_service: null }))
        await store.load()
        expect(store.serverOffsetMs).toBe(2 * 3600 * 1000)
        expect(store.now().toISOString()).toBe('2026-10-16T12:00:00.000Z')
    })

    it('sets error on failure and recovers on retry', async () => {
        const getNext = vi.fn()
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ status: 'none', server_now: new Date().toISOString(), service: null, next_service: null })
        const store = makeStore(getNext)
        await store.load()
        expect(store.error).toBe(true)
        await store.retry()
        expect(store.error).toBe(false)
        expect(store.status).toBe('none')
    })
})
