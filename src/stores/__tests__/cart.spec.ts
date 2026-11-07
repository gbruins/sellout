import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '../cart'
import { stubApi } from '@/test/stubApi'

const cartData = (items: { id: string, qty: number, pid: string }[] = [], extra: Record<string, unknown> = {}) => ({
    id: 'c1', num_items: items.reduce((n, i) => n + i.qty, 0), price_subtotal: 0, grand_total: 0,
    customer_note: null, checkout_in_progress: false,
    cart_items: items.map((i) => ({ id: i.id, qty: i.qty, price_subtotal: 0, product: { id: i.pid, title: 'P', base_price: 1000 } })),
    ...extra,
})

const pizza = { id: 'p1', title: 'P', description: null, base_price: 1000 }

let cartId: string | null
const forget = vi.fn<(...args: never[]) => unknown>(() => { cartId = null })

beforeEach(() => {
    setActivePinia(createPinia())
    cartId = 'c1'
    forget.mockClear()
    stubApi({ cart: { credentials: () => ({ id: cartId, token: 't' }), forget } })
})

describe('cart store', () => {
    it('creates the cart on first order, then adds one', async () => {
        cartId = null
        const create = vi.fn<(...args: never[]) => unknown>(async () => { cartId = 'c1'; return { data: { id: 'c1', cart_token: 't' } } })
        const addItem = vi.fn<(...args: never[]) => unknown>(async () => ({ data: {} }))
        stubApi({ cart: { create, addItem, get: async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }) } })
        const store = useCartStore()

        expect(await store.addPizza(pizza)).toBe(true)

        expect(create).toHaveBeenCalled()
        expect(addItem).toHaveBeenCalledWith({ product_id: 'p1', qty: 1 })
        expect(store.count).toBe(1)
    })

    it('raises the quantity on a repeat order', async () => {
        const updateItem = vi.fn<(...args: never[]) => unknown>(async () => ({ data: {} }))
        stubApi({ cart: { updateItem, get: async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }) } })
        const store = useCartStore()
        await store.load()
        await store.addPizza(pizza)
        expect(updateItem).toHaveBeenCalledWith({ id: 'l1', qty: 2 })
    })

    it('ignores a second action while busy, and reports that it did nothing', async () => {
        let release: () => void = () => {}
        const addItem = vi.fn<(...args: never[]) => unknown>(() => new Promise<{ data: unknown }>((r) => { release = () => r({ data: {} }) }))
        stubApi({ cart: { addItem, get: async () => ({ data: cartData() }) } })
        const store = useCartStore()
        await store.load()
        const first = store.addPizza(pizza)
        await Promise.resolve()
        expect(await store.addPizza(pizza)).toBe(false)
        expect(store.error).toBeNull()
        release()
        expect(await first).toBe(true)
        expect(addItem).toHaveBeenCalledTimes(1)
    })

    it('shares one request when several callers load at once', async () => {
        const get = vi.fn<(...args: never[]) => unknown>(async () => ({ data: cartData() }))
        stubApi({ cart: { get } })
        const store = useCartStore()
        expect(store.loaded).toBe(false)
        await Promise.all([store.load(), store.load()])
        expect(get).toHaveBeenCalledTimes(1)
        expect(store.loaded).toBe(true)
    })

    it('stores the error as a message key and marks an unavailable item', async () => {
        const err = { response: { status: 409, data: { data: { code: 'item_unavailable', product_id: 'p1', title: 'Margherita' } } } }
        stubApi({ cart: { checkout: async () => { throw err }, get: async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }) } })
        const store = useCartStore()
        expect(await store.pay()).toBe(false)
        expect(store.error).toEqual({ key: 'errors.itemUnavailable', params: { title: 'Margherita' } })
        expect(store.unavailableProductId).toBe('p1')
        expect(store.busy).toBeNull()
        expect(store.checkoutClientSecret).toBeNull()
    })

    it('stores the client_secret from pay, and reloads the cart so locked updates right away', async () => {
        stubApi({ cart: {
            checkout: async () => ({ data: { client_secret: 'cs_test_x_secret_y' } }),
            get: async () => ({ data: cartData([], { checkout_in_progress: true }) }),
        } })
        const store = useCartStore()
        expect(await store.pay()).toBe(true)
        expect(store.checkoutClientSecret).toBe('cs_test_x_secret_y')
        expect(store.locked).toBe(true)
    })

    it('saves an unsaved kitchen note before starting payment', async () => {
        const calls: string[] = []
        stubApi({ cart: {
            get: async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }),
            setCustomerNote: async (note: string | null) => { calls.push(`note:${note}`); return { data: {} } },
            checkout: async () => { calls.push('checkout'); return { data: { client_secret: 's' } } },
        } })
        const store = useCartStore()
        await store.load()
        store.noteDraft = 'extra crispy'

        await store.pay()

        expect(calls).toEqual(['note:extra crispy', 'checkout'])
        expect(store.noteDirty).toBe(false)
    })

    it('keeps the draft the visitor is typing when the cart refreshes', async () => {
        stubApi({ cart: { get: async () => ({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }), updateItem: async () => ({ data: {} }) } })
        const store = useCartStore()
        await store.load()
        store.noteDraft = 'half typed'
        await store.setQty('l1', 2)
        expect(store.noteDraft).toBe('half typed')
    })

    it('ignores a cart response that arrives after the cart was forgotten', async () => {
        let release: () => void = () => {}
        stubApi({ cart: { get: () => new Promise((r) => { release = () => r({ data: cartData([{ id: 'l1', qty: 1, pid: 'p1' }]) }) }) } })
        const store = useCartStore()
        const loading = store.load()
        store.forget()
        release()
        await loading
        expect(store.count).toBe(0)
    })

    it('forgets the remembered cart only once it is closed', async () => {
        let closed: string | null = null
        stubApi({ cart: { get: async () => ({ data: cartData([], { closed_at: closed }) }) } })
        const store = useCartStore()

        await store.forgetIfClosed()
        expect(forget).not.toHaveBeenCalled()

        closed = '2026-11-07T20:00:00.000Z'
        await store.forgetIfClosed()
        expect(forget).toHaveBeenCalled()
    })

    it('a 404 on load gives an empty cart with no error', async () => {
        stubApi({ cart: { get: async () => { throw { response: { status: 404 } } } } })
        const store = useCartStore()
        await store.load()
        expect(store.cart).toBeNull()
        expect(store.error).toBeNull()
        expect(store.loaded).toBe(true)
    })

    it('refreshes the cart after a refused edit so a stale tab catches up', async () => {
        const err = { response: { status: 409, data: { data: { code: 'over_limit', max_per_order: 4, remaining: 4 } } } }
        stubApi({ cart: { updateItem: async () => { throw err }, get: async () => ({ data: cartData([{ id: 'l1', qty: 2, pid: 'p1' }]) }) } })
        const store = useCartStore()
        await store.setQty('l1', 5)
        expect(store.count).toBe(2)
        expect(store.error).toEqual({ key: 'errors.overLimit', params: { n: 4 }, plural: 4 })
    })
})
