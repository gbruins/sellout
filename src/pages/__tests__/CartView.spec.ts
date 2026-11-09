import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import CartView from '../CartView.vue'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'
import { stubApi } from '@/test/stubApi'

const mountCheckout = vi.fn<(...args: never[]) => unknown>()
const destroyCheckout = vi.fn<(...args: never[]) => unknown>()
vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn<(...args: never[]) => Promise<unknown>>(async () => ({
        createEmbeddedCheckoutPage: vi.fn<(...args: never[]) => Promise<unknown>>(async () => ({ mount: mountCheckout, unmount: vi.fn<(...args: never[]) => unknown>(), destroy: destroyCheckout })),
    })),
}))

vi.mock('vue-sonner', () => ({ toast: vi.fn<(...args: never[]) => unknown>() }))

const line = { id: 'l1', qty: 1, price_subtotal: 1400, product: { id: 'p1', title: 'Margherita', base_price: 1400 } }
const cartData = (extra: Record<string, unknown> = {}) => ({
    id: 'c1', num_items: 1, price_subtotal: 1400, grand_total: 1400, customer_note: null,
    checkout_in_progress: false, cart_items: [line], ...extra,
})
const serviceState = (status: string) => ({ status, server_now: new Date().toISOString(), timezone: null, service: null, next_service: null, remaining: 5 })

type Fn = (...args: never[]) => unknown

const mountView = async (cart: Record<string, Fn>, status = 'open') => {
    setActivePinia(createPinia())
    stubApi({ cart: { credentials: () => ({ id: 'c1', token: 't' }), ...cart }, service: { getNext: async () => serviceState(status) } })
    await useServiceStore().load()
    const wrapper = mount(CartView, { global: { stubs: { RouterLink: true } } })
    return wrapper
}

describe('CartView', () => {
    it('shows a loading skeleton, not "empty", until the cart arrives', async () => {
        let release: () => void = () => {}
        const wrapper = await mountView({ get: () => new Promise((r) => { release = () => r({ data: cartData() }) }) })
        expect(wrapper.find('[data-test=cart-loading]').exists()).toBe(true)
        expect(wrapper.find('[data-test=empty]').exists()).toBe(false)
        release()
        await flushPromises()
        expect(wrapper.find('[data-test=cart-loading]').exists()).toBe(false)
        expect(wrapper.find('[data-test=cart-line]').exists()).toBe(true)
    })

    it('labels Pay with the total, without a currency symbol', async () => {
        const wrapper = await mountView({ get: async () => ({ data: cartData() }) })
        await flushPromises()
        expect(wrapper.get('[data-test=pay]').text()).toBe('Continue to payment · 14.00')
        expect(wrapper.get('[data-test=total]').text()).toBe('14.00')
    })

    it('shows the locked state, mounts the embedded form, and no edits', async () => {
        const cancelCheckout = vi.fn<(...args: never[]) => unknown>(async () => ({ data: { status: 'cancelled' } }))
        const checkout = vi.fn<(...args: never[]) => unknown>(async () => ({ data: { client_secret: 'cs_test_x_secret_y' } }))
        let locked = true
        const wrapper = await mountView({ get: async () => ({ data: cartData({ checkout_in_progress: locked }) }), cancelCheckout, checkout })
        await flushPromises()
        // Already locked on arrival (e.g. a page reload) — the page fetches the existing
        // session's client_secret on its own, with no click required, and mounts the form.
        expect(checkout).toHaveBeenCalled()
        expect(mountCheckout).toHaveBeenCalledWith(wrapper.get('[data-test=embedded-checkout]').element)
        expect(wrapper.find('[data-test=locked]').text()).toContain('finish paying')
        expect(wrapper.find('[data-test=remove]').exists()).toBe(false)
        expect(wrapper.find('[data-test=pay]').exists()).toBe(false)
        locked = false
        await wrapper.find('[data-test=cancel]').trigger('click')
        await flushPromises()
        expect(cancelCheckout).toHaveBeenCalled()
        expect(destroyCheckout).toHaveBeenCalled()
        expect(wrapper.find('[data-test=pay]').exists()).toBe(true)
    })

    it('highlights the unavailable pizza and lets the visitor remove it', async () => {
        const err = { response: { status: 409, data: { data: { code: 'item_unavailable', product_id: 'p1', title: 'Margherita' } } } }
        const wrapper = await mountView({ get: async () => ({ data: cartData() }), checkout: async () => { throw err }, removeItem: async () => ({ data: {} }) })
        await flushPromises()
        await wrapper.find('[data-test=pay]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-test=cart-error]').text()).toContain('"Margherita" is no longer available')
        expect(wrapper.find('[data-test=cart-line]').classes().join(' ')).toContain('border-destructive')
        expect(wrapper.find('[data-test=remove]').exists()).toBe(true)
    })

    it.each([['sold_out', 'sold out'], ['upcoming', 'not open'], ['none', 'not open']])('disables Pay when %s', async (status, text) => {
        const wrapper = await mountView({ get: async () => ({ data: cartData() }) }, status)
        await flushPromises()
        expect((wrapper.find('[data-test=pay]').element as HTMLButtonElement).disabled).toBe(true)
        expect(wrapper.find('[data-test=closed-reason]').text()).toContain(text)
    })

    it('offers Retry on a network error and keeps the cart', async () => {
        let fail = false
        const wrapper = await mountView({ get: async () => { if(fail) throw new Error('network'); return { data: cartData() } } })
        await flushPromises()
        fail = true
        await useCartStore().load()
        await flushPromises()
        expect(wrapper.find('[data-test=retry]').exists()).toBe(true)
        expect(wrapper.find('[data-test=total]').exists()).toBe(true)
    })

    it('plus, minus and remove call the server and show its cart', async () => {
        let qty = 2
        const updateItem = vi.fn<(...args: never[]) => unknown>(async (data: { qty: number }) => { qty = data.qty; return { data: {} } })
        const removeItem = vi.fn<(...args: never[]) => unknown>(async () => { qty = 0; return { data: {} } })
        const wrapper = await mountView({
            get: async () => ({ data: cartData({ cart_items: qty ? [{ ...line, qty }] : [] }) }),
            updateItem, removeItem,
        })
        await flushPromises()
        await wrapper.find('[data-test=plus]').trigger('click'); await flushPromises()
        expect(updateItem).toHaveBeenLastCalledWith({ id: 'l1', qty: 3 })
        await wrapper.find('[data-test=minus]').trigger('click'); await flushPromises()
        expect(updateItem).toHaveBeenLastCalledWith({ id: 'l1', qty: 2 })
        qty = 1
        await useCartStore().load(); await flushPromises()
        await wrapper.find('[data-test=minus]').trigger('click'); await flushPromises()
        expect(removeItem).toHaveBeenCalledWith('l1')
        expect(wrapper.find('[data-test=empty]').exists()).toBe(true)
    })

    it('shows the server limit message and leaves the cart unchanged', async () => {
        const err = { response: { status: 409, data: { data: { code: 'over_limit', max_per_order: 4, remaining: 3 } } } }
        const wrapper = await mountView({ get: async () => ({ data: cartData() }), updateItem: async () => { throw err } })
        await flushPromises()
        await wrapper.find('[data-test=plus]').trigger('click'); await flushPromises()
        expect(wrapper.find('[data-test=cart-error]').text()).toContain('You can order up to 3 pizzas.')
        expect(wrapper.find('[data-test=qty]').text()).toBe('1')
    })

    it('saves the note on blur, shows it as text, and clears when empty', async () => {
        const setCustomerNote = vi.fn<(...args: never[]) => unknown>(async () => ({ data: {} }))
        const wrapper = await mountView({ get: async () => ({ data: cartData({ customer_note: '<b>x</b>' }) }), setCustomerNote })
        await flushPromises()
        const note = wrapper.find('[data-test=note]')
        expect((note.element as HTMLTextAreaElement).value).toBe('<b>x</b>')
        expect(wrapper.find('b').exists()).toBe(false)
        await note.setValue('  ')
        await note.trigger('blur'); await flushPromises()
        expect(setCustomerNote).toHaveBeenCalledWith(null)
        expect(wrapper.find('[data-test=note-count]').text()).toContain('/ 500')
        expect(wrapper.find('[data-test=note-status]').text()).toBe('Saved')
    })

    it('typing a note then tapping Pay saves the note and still opens payment', async () => {
        const calls: string[] = []
        const wrapper = await mountView({
            get: async () => ({ data: cartData() }),
            setCustomerNote: async (note: string | null) => { calls.push(`note:${note}`); return { data: {} } },
            checkout: async () => { calls.push('checkout'); return { data: { client_secret: 's' } } },
        })
        await flushPromises()
        const note = wrapper.find('[data-test=note]')
        await note.setValue('no basil')
        // Tapping Pay blurs the note field first, which starts a save
        await note.trigger('blur')
        await wrapper.find('[data-test=pay]').trigger('click')
        await flushPromises()
        expect(calls).toEqual(['note:no basil', 'checkout'])
    })

    it('hides item controls but keeps the note editable when locked', async () => {
        const setCustomerNote = vi.fn<(...args: never[]) => unknown>(async () => ({ data: {} }))
        const wrapper = await mountView({
            get: async () => ({ data: cartData({ checkout_in_progress: true }) }),
            checkout: async () => ({ data: { client_secret: 'cs_test_x_secret_y' } }),
            setCustomerNote,
        })
        await flushPromises()
        expect(wrapper.find('[data-test=plus]').exists()).toBe(false)
        // Stripe's form shows the total, so ours is hidden on the checkout step
        expect(wrapper.find('[data-test=total]').exists()).toBe(false)
        expect(wrapper.find('[data-test=pickup]').exists()).toBe(false)

        const note = wrapper.find('[data-test=note]')
        await note.setValue('extra crispy please')
        await note.trigger('blur'); await flushPromises()
        expect(setCustomerNote).toHaveBeenCalledWith('extra crispy please')
    })
})
