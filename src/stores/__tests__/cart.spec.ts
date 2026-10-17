import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { useCartStore } from '../cart'

const cartData = (items: { id: string, qty: number, pid: string }[] = []) => ({
    id: 'c1', num_items: items.reduce((n, i) => n + i.qty, 0), price_subtotal: 0, grand_total: 0,
    customer_note: null, checkout_in_progress: false,
    cart_items: items.map((i) => ({ id: i.id, qty: i.qty, price_subtotal: 0, product: { id: i.pid, title: 'P', base_price: 1000 } })),
})

const makeStore = (cart: Record<string, unknown>) => {
    const app = createApp({})
    app.use(createPinia())
    app.provide('$api', { cart })
    return app.runWithContext(() => useCartStore())
}

const mock = (impl: (...args: any[]) => unknown) => vi.fn<(...args: any[]) => unknown>(impl) // eslint-disable-line @typescript-eslint/no-explicit-any

const pizza = { id: 'p1', title: 'P', description: null, base_price: 1000 }

describe('cart store', () => {
    it('creates the cart on first order, then adds one', async () => {
        const cart = {
            credentials: mock(() => ({ id: null })),
            create: mock(async () => ({})),
            addItem: mock(async () => ({})),
            get: mock(async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) })),
        }
        const store = makeStore(cart)
        await store.addPizza(pizza)
        expect(cart.create).toHaveBeenCalled()
        expect(cart.addItem).toHaveBeenCalledWith({ product_id: 'p1', qty: 1 })
        expect(store.count).toBe(1)
    })

    it('raises the quantity on a repeat order', async () => {
        const cart = {
            credentials: mock(() => ({ id: 'c1' })),
            updateItem: mock(async () => ({})),
            get: mock(async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) })),
        }
        const store = makeStore(cart)
        await store.load()
        await store.addPizza(pizza)
        expect(cart.updateItem).toHaveBeenCalledWith({ id: 'l1', qty: 2 })
    })

    it('ignores a second action while busy', async () => {
        let release: () => void = () => {}
        const cart = {
            credentials: mock(() => ({ id: 'c1' })),
            addItem: mock(() => new Promise<void>((r) => { release = r })),
            get: mock(async () => ({ data: cartData() })),
        }
        const store = makeStore(cart)
        const first = store.addPizza(pizza)
        await Promise.resolve()
        await store.addPizza(pizza)
        release()
        await first
        expect(cart.addItem).toHaveBeenCalledTimes(1)
    })

    it('keeps the server message and marks an unavailable item', async () => {
        const err = { response: { status: 409, data: { message: 'x', data: { code: 'item_unavailable', product_id: 'p1', title: 'Margherita' } } } }
        const cart = {
            credentials: mock(() => ({ id: 'c1' })),
            checkout: mock(async () => { throw err }),
            get: mock(async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) })),
        }
        const store = makeStore(cart)
        expect(await store.pay()).toBeNull()
        expect(store.error).toContain('"Margherita" is no longer available')
        expect(store.unavailableProductId).toBe('p1')
        expect(store.busy).toBeNull()
    })

    it('returns the Stripe url from pay', async () => {
        const cart = { credentials: mock(() => ({ id: 'c1' })), checkout: mock(async () => ({ data: { url: 'https://stripe.test/x' } })) }
        expect(await makeStore(cart).pay()).toBe('https://stripe.test/x')
    })

    it('ignores a cart response that arrives after the cart was forgotten', async () => {
        let id: string | null = 'c1'
        let release: () => void = () => {}
        const cart = {
            credentials: mock(() => ({ id })),
            get: mock(() => new Promise((r) => { release = () => r({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }) })),
        }
        const store = makeStore(cart)
        const loading = store.load()
        id = null
        store.reset()
        release()
        await loading
        expect(store.count).toBe(0)
    })

    it('a 404 on load gives an empty cart with no error', async () => {
        const cart = {
            credentials: mock(() => ({ id: 'c1' })),
            get: mock(async () => { throw { response: { status: 404 } } }),
        }
        const store = makeStore(cart)
        await store.load()
        expect(store.cart).toBeNull()
        expect(store.error).toBeNull()
    })

    it('refreshes the cart after a refused edit so a stale tab catches up', async () => {
        const err = { response: { status: 409, data: { data: { code: 'over_limit', max_per_order: 4, remaining: 4 } } } }
        const cart = {
            credentials: mock(() => ({ id: 'c1' })),
            updateItem: mock(async () => { throw err }),
            get: mock(async () => ({ data: cartData([{ id: 'l1', qty: 2, pid: 'p1' }]) })),
        }
        const store = makeStore(cart)
        await store.setQty('l1', 5)
        expect(store.count).toBe(2)
        expect(store.error).toContain('up to 4')
    })
})
