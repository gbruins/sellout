import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import HomeView from '../HomeView.vue'

vi.mock('@/utils/serviceStream', () => ({ openServiceStream: vi.fn(() => vi.fn()) }))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const routerPush = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }) }))

beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    routerPush.mockClear()
})

const mountHome = (getNext: () => Promise<unknown>, cart: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) =>
    mount(HomeView, {
        global: { plugins: [createPinia()], provide: { $api: { service: { getNext }, cart: { credentials: () => ({ id: null }), ...cart } } } },
        ...opts,
    })

const win = { id: 's', start_at: '2026-10-17T19:00:00.000Z', end_at: '2026-10-18T02:00:00.000Z', notes: 'Pickup at the garage door', inventory_count: 60, max_per_order: 4 }
const base = { server_now: '2026-10-16T12:00:00.000Z', next_service: null }

describe('HomeView', () => {
    it('shows the next service in Los Angeles time when closed', async () => {
        const wrapper = mountHome(async () => ({ ...base, status: 'upcoming', service: win }))
        await flushPromises()
        expect(wrapper.get('[data-test="service-range"]').text()).toBe('Saturday, October 17, 12:00 PM – 7:00 PM PDT')
        expect(wrapper.get('[data-test="service-notes"]').text()).toBe('Pickup at the garage door')
        expect(wrapper.text()).not.toContain('Pizzas remaining')
    })

    it('shows an empty message when no service exists', async () => {
        const wrapper = mountHome(async () => ({ ...base, status: 'none', service: null }))
        await flushPromises()
        expect(wrapper.text()).toContain('No service scheduled')
    })

    it('shows the live view when open', async () => {
        const wrapper = mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 41, menu: null }))
        await flushPromises()
        expect(wrapper.get('[role="status"]').text()).toBe('41 pizzas remaining')
    })

    it('lists the menu products with prices when open', async () => {
        const menu = { id: 'm', title: 'Menu', description: null, products: [{ id: 'p', title: 'Margherita', description: null, base_price: 2200 }] }
        const wrapper = mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }))
        await flushPromises()
        expect(wrapper.text()).toContain('Margherita')
        expect(wrapper.text()).toContain('22.00')
    })

    it('shows the menu-not-available message when open without a menu', async () => {
        const wrapper = mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 5, menu: null }))
        await flushPromises()
        expect(wrapper.text()).toContain('Menu not available yet')
    })

    it('shows sold out with the next service time', async () => {
        const next = { ...win, id: 'n', start_at: '2026-10-24T19:00:00.000Z', end_at: '2026-10-25T02:00:00.000Z', notes: null }
        const wrapper = mountHome(async () => ({ ...base, status: 'sold_out', service: win, remaining: 0, menu: null, next_service: next }))
        await flushPromises()
        expect(wrapper.text()).toContain("sold out")
        expect(wrapper.get('[data-test="service-range"]').text()).toBe('Saturday, October 24, 12:00 PM – 7:00 PM PDT')
    })

    it('disables ordering when sold out', async () => {
        const menu = { id: 'm', title: 'Menu', description: null, products: [{ id: 'p', title: 'Margherita', description: null, base_price: 2200 }] }
        const wrapper = mountHome(async () => ({ ...base, status: 'sold_out', service: win, remaining: 0, menu }))
        await flushPromises()
        expect(wrapper.get('li button').attributes('disabled')).toBeDefined()
    })

    it('shows the added-to-cart popup (not a toast) when an order is placed', async () => {
        const menu = { id: 'm', title: 'Menu', description: null, products: [{ id: 'p', title: 'Margherita', description: null, base_price: 2200 }] }
        const wrapper = mountHome(
            async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }),
            {
                create: vi.fn(async () => ({})),
                addItem: vi.fn(async () => ({})),
                get: vi.fn(async () => ({ data: { id: 'c1', num_items: 1, price_subtotal: 2200, grand_total: 2200, customer_note: null, checkout_in_progress: false, cart_items: [] } })),
            },
            // AddedToCartPopup uses <Teleport to="body"> — attach to a real DOM node so its
            // content lands in document.body predictably and can be found below.
            { attachTo: document.body },
        )
        await flushPromises()

        await wrapper.get('[data-test="order"]').trigger('click')
        await flushPromises()

        const popup = document.querySelector('[data-test="added-to-cart-popup"]')
        expect(popup).not.toBeNull()
        expect(popup!.textContent).toContain('Margherita')
        expect(popup!.textContent).toContain('Qty 1')
        expect(popup!.textContent).toContain('22.00')
        expect(toast.success).not.toHaveBeenCalled()
        expect(toast.error).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('Checkout in the popup navigates to the cart and starts payment', async () => {
        const menu = { id: 'm', title: 'Menu', description: null, products: [{ id: 'p', title: 'Margherita', description: null, base_price: 2200 }] }
        const checkout = vi.fn(async () => ({ data: { client_secret: 'cs_test_x_secret_y' } }))
        const wrapper = mountHome(
            async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }),
            {
                create: vi.fn(async () => ({})),
                addItem: vi.fn(async () => ({})),
                checkout,
                get: vi.fn(async () => ({ data: { id: 'c1', num_items: 1, price_subtotal: 2200, grand_total: 2200, customer_note: null, checkout_in_progress: false, cart_items: [] } })),
            },
            { attachTo: document.body },
        )
        await flushPromises()

        await wrapper.get('[data-test="order"]').trigger('click')
        await flushPromises()

        const checkoutButton = document.querySelector<HTMLButtonElement>('[data-test="checkout"]')
        expect(checkoutButton).not.toBeNull()
        checkoutButton!.click()
        await flushPromises()

        expect(routerPush).toHaveBeenCalledWith('/cart')
        expect(checkout).toHaveBeenCalled()
        expect(document.querySelector('[data-test="added-to-cart-popup"]')).toBeNull()
        wrapper.unmount()
    })

    it('shows an error toast, not a success toast, when the order exceeds the limit', async () => {
        const menu = { id: 'm', title: 'Menu', description: null, products: [{ id: 'p', title: 'Margherita', description: null, base_price: 2200 }] }
        const err = { response: { status: 409, data: { data: { code: 'over_limit', max_per_order: 4, remaining: 3 } } } }
        const wrapper = mountHome(
            async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }),
            { create: vi.fn(async () => ({})), addItem: vi.fn(async () => { throw err }) },
        )
        await flushPromises()

        await wrapper.get('[data-test="order"]').trigger('click')
        await flushPromises()

        expect(toast.error).toHaveBeenCalledWith('You can order up to 3 pizzas.')
        expect(toast.success).not.toHaveBeenCalled()
    })

    it('shows an error notice and retries', async () => {
        const getNext = vi.fn()
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ ...base, status: 'none', service: null })
        const wrapper = mountHome(getNext)
        await flushPromises()
        expect(wrapper.text()).toContain('out of date')
        await wrapper.get('[data-test="retry"]').trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('No service scheduled')
        expect(wrapper.text()).not.toContain('out of date')
    })
})
