import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useServiceStore } from '../service'
import { openServiceStream } from '@/utils/serviceStream'

vi.mock('@/utils/serviceStream', () => ({ openServiceStream: vi.fn(() => vi.fn()) }))

const lastHandlers = () => {
    const calls = vi.mocked(openServiceStream).mock.calls
    return calls[calls.length - 1]![1]
}

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

    describe('live stream', () => {
        const openState = (remaining: number) => ({
            status: 'open' as const, server_now: new Date().toISOString(), service: window, remaining,
            menu: null, next_service: null,
        })

        it('applies pushed state', async () => {
            const store = makeStore(async () => openState(41))
            await store.load()
            store.connect()
            lastHandlers().onState(openState(40))
            expect(store.remaining).toBe(40)
            store.disconnect()
        })

        it('marks stale on disconnect and shows the current count after reconnect', async () => {
            const store = makeStore(async () => openState(41))
            await store.load()
            store.connect()
            lastHandlers().onDisconnected?.()
            expect(store.stale).toBe(true)
            lastHandlers().onState(openState(33))
            expect(store.stale).toBe(false)
            expect(store.remaining).toBe(33)
            store.disconnect()
        })

        it('only opens one stream and closes it on disconnect', async () => {
            const stop = vi.fn()
            vi.mocked(openServiceStream).mockReturnValueOnce(stop)
            const store = makeStore(async () => openState(1))
            const before = vi.mocked(openServiceStream).mock.calls.length
            store.connect()
            store.connect()
            expect(vi.mocked(openServiceStream).mock.calls.length - before).toBe(1)
            store.disconnect()
            expect(stop).toHaveBeenCalled()
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
            await vi.advanceTimersByTimeAsync(61_000)
            expect(store.status).toBe('upcoming')
            expect(store.service?.id).toBe('s2')
            store.disconnect()
        })
    })
})
