import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useServiceStore } from '../service'

// A fake Supabase Realtime client standing in for serviceRealtime.ts's getServiceRealtimeClient()
// — captures the postgres_changes handler and the subscribe() status callback so tests can
// simulate activity events and connection-state transitions without a real Supabase connection.
const { fakeClient, getHandlers, getStatusCb, resetFakeRealtime } = vi.hoisted(() => {
    let handlers: Array<() => void> = []
    let statusCb: ((status: string) => void) | null = null

    const fakeChannel = {
        on: (_event: string, _filter: unknown, handler: () => void) => {
            handlers.push(handler)
            return fakeChannel
        },
        subscribe: (cb: (status: string) => void) => {
            statusCb = cb
            return fakeChannel
        },
    }

    const channel = vi.fn(() => fakeChannel)
    const removeChannel = vi.fn()

    return {
        fakeClient: { realtime: { setAuth: vi.fn() }, channel, removeChannel },
        getHandlers: () => handlers,
        getStatusCb: () => statusCb,
        resetFakeRealtime: () => {
            handlers = []
            statusCb = null
            channel.mockClear()
            removeChannel.mockClear()
        },
    }
})

vi.mock('@/plugins/serviceRealtime', () => ({ getServiceRealtimeClient: () => fakeClient }))

const triggerActivity = () => getHandlers().forEach((h) => h())
const triggerStatus = (status: string) => getStatusCb()?.(status)

const makeStore = (getNext: () => Promise<unknown>, getRealtimeToken?: () => Promise<unknown>) => {
    const app = createApp({})
    const pinia = createPinia()
    app.use(pinia)
    app.provide('$api', {
        service: {
            getNext,
            getRealtimeToken: getRealtimeToken ?? (async () => ({ realtime_jwt: 'test-jwt', tenant_id: 't1' })),
        },
    })
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

    describe('realtime updates', () => {
        afterEach(() => resetFakeRealtime())

        const openState = (remaining: number) => ({
            status: 'open' as const, server_now: new Date().toISOString(), timezone: 'America/Los_Angeles', service: window, remaining,
            menu: null, next_service: null,
        })

        it('refetches and applies the new state on a realtime activity signal', async () => {
            const getNext = vi.fn()
                .mockResolvedValueOnce(openState(41))
                .mockResolvedValueOnce(openState(40))
            const store = makeStore(getNext)
            await store.load()
            store.connect()
            await vi.waitFor(() => { if (!getStatusCb()) throw new Error('not subscribed yet') })
            triggerStatus('SUBSCRIBED')
            expect(store.stale).toBe(false)

            triggerActivity()
            await vi.waitFor(() => expect(store.remaining).toBe(40))
            store.disconnect()
        })

        it('marks stale when the channel drops, but polling keeps the data correct', async () => {
            const getNext = vi.fn()
                .mockResolvedValueOnce(openState(41))
                .mockResolvedValueOnce(openState(33))
            const store = makeStore(getNext)
            await store.load()
            store.connect()
            await vi.waitFor(() => { if (!getStatusCb()) throw new Error('not subscribed yet') })
            triggerStatus('SUBSCRIBED')
            expect(store.stale).toBe(false)

            triggerStatus('CHANNEL_ERROR')
            expect(store.stale).toBe(true)
            await vi.waitFor(() => expect(store.remaining).toBe(33))
            store.disconnect()
        })

        it('only subscribes once and tears the channel down on disconnect', async () => {
            const getNext = vi.fn().mockResolvedValue(openState(1))
            const store = makeStore(getNext)
            await store.load()
            store.connect()
            store.connect()
            await vi.waitFor(() => { if (!getStatusCb()) throw new Error('not subscribed yet') })
            expect(fakeClient.channel).toHaveBeenCalledTimes(1)
            store.disconnect()
            expect(fakeClient.removeChannel).toHaveBeenCalledTimes(1)
        })

        it('falls back to polling when no realtime token is available', async () => {
            vi.useFakeTimers()
            const getNext = vi.fn()
                .mockResolvedValueOnce(openState(41))
                .mockResolvedValueOnce(openState(40))
            const store = makeStore(getNext, async () => ({ realtime_jwt: null, tenant_id: null }))
            await store.load()
            store.connect()
            await vi.advanceTimersByTimeAsync(0)
            // Silent degradation, not an error — no realtime JWT just means never-upgraded,
            // not "a live connection dropped" (see startPolling's markStale parameter).
            expect(store.stale).toBe(false)
            await vi.advanceTimersByTimeAsync(5000)
            expect(store.remaining).toBe(40)
            store.disconnect()
        })

        it('refetches at the start boundary and moves from upcoming to open', async () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-10-17T18:59:00.000Z'))
            const upcoming = { status: 'upcoming' as const, server_now: '2026-10-17T18:59:00.000Z', service: window, next_service: null }
            const getNext = vi.fn()
                .mockResolvedValueOnce(upcoming)
                .mockResolvedValueOnce({ ...openState(60), server_now: '2026-10-17T19:00:01.000Z' })
            const store = makeStore(getNext)
            await store.load()
            store.connect()
            await vi.advanceTimersByTimeAsync(0)
            expect(store.status).toBe('upcoming')
            await vi.advanceTimersByTimeAsync(61_000)
            expect(getNext).toHaveBeenCalledTimes(2)
            expect(store.status).toBe('open')
            store.disconnect()
        })

        it('refetches at the end boundary and moves to the next service', async () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-10-18T01:59:00.000Z'))
            const next = { ...window, id: 's2', start_at: '2026-10-19T19:00:00.000Z', end_at: '2026-10-20T02:00:00.000Z' }
            const getNext = vi.fn()
                .mockResolvedValueOnce({ ...openState(5), server_now: '2026-10-18T01:59:00.000Z' })
                .mockResolvedValueOnce({ status: 'upcoming', server_now: '2026-10-18T02:00:01.000Z', service: next, next_service: null })
            const store = makeStore(getNext)
            await store.load()
            store.connect()
            await vi.advanceTimersByTimeAsync(0)
            await vi.advanceTimersByTimeAsync(61_000)
            expect(store.status).toBe('upcoming')
            expect(store.service?.id).toBe('s2')
            store.disconnect()
        })
    })
})
