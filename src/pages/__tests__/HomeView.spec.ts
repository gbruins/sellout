import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import HomeView from '../HomeView.vue'
import { useServiceStore } from '@/stores/service'
import { stubApi } from '@/test/stubApi'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn<(...args: never[]) => unknown>(), error: vi.fn<(...args: never[]) => unknown>() } }))

const routerPush = vi.fn<(...args: never[]) => unknown>()
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }), RouterLink: { template: '<a><slot /></a>' } }))

beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    routerPush.mockClear()
})

const win = { id: 's', start_at: '2026-10-17T19:00:00.000Z', end_at: '2026-10-18T02:00:00.000Z', notes: 'Pickup at the garage door', inventory_count: 60, max_per_order: 4 }
const base = { server_now: '2026-10-16T12:00:00.000Z', timezone: null, next_service: null }
const menu = { id: 'm', title: 'Menu', description: null, products: [{ id: 'p', title: 'Margherita', description: null, base_price: 2200 }] }
const emptyCart = { id: 'c1', num_items: 1, price_subtotal: 2200, grand_total: 2200, customer_note: null, checkout_in_progress: false, cart_items: [] }

// The layout loads the service status in the app; here the test loads it before mounting
const mountHome = async (getNext: () => Promise<unknown>, cart: Record<string, (...args: never[]) => unknown> = {}) => {
    setActivePinia(createPinia())
    stubApi({ service: { getNext }, cart: { credentials: () => ({ id: null, token: null }), ...cart } })
    await useServiceStore().load()
    const wrapper = mount(HomeView)
    await flushPromises()
    return wrapper
}

describe('HomeView', () => {
    it('shows the next service in the shop time zone when closed', async () => {
        const wrapper = await mountHome(async () => ({ ...base, status: 'upcoming', service: win }))
        expect(wrapper.get('[data-test="service-date"]').text()).toBe('Saturday, October 17')
        expect(wrapper.get('[data-test="service-times"]').text()).toBe('12:00 PM – 7:00 PM PDT')
        expect(wrapper.get('[data-test="service-notes"]').text()).toBe('Pickup at the garage door')
        expect(wrapper.text()).not.toContain('Pizzas remaining')
    })

    it('shows an empty message when no service exists', async () => {
        const wrapper = await mountHome(async () => ({ ...base, status: 'none', service: null }))
        expect(wrapper.text()).toContain('No service scheduled')
    })

    it('shows the live view with pizzas remaining and the closing time when open', async () => {
        const wrapper = await mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 41, menu: null }))
        expect(wrapper.get('[role="status"]').text()).toBe('41 pizzas remaining')
        expect(wrapper.get('[data-test="open-until"]').text()).toBe('Open until 7:00 PM, or until we sell out.')
    })

    it('shows where to pick up when the shop has an address', async () => {
        const shop = { name: 'Sellout', address_line1: '1 Oven Way', address_line2: null, address_city: 'Portland', address_state: 'OR', address_postal_code: '97201', phone: '555-0100' }
        const wrapper = await mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 5, menu: null, shop }))
        const pickup = wrapper.get('[data-test="pickup-info"]')
        expect(pickup.text()).toContain('1 Oven Way')
        // The hero is compact: street and city only
        expect(pickup.text()).toContain('Portland')
        expect(pickup.text()).not.toContain('97201')
        expect(pickup.find('a[href="tel:555-0100"]').exists()).toBe(true)
    })

    it('lists the menu products with prices and no currency symbol', async () => {
        const wrapper = await mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }))
        expect(wrapper.text()).toContain('Margherita')
        expect(wrapper.get('[data-test="price"]').text()).toBe('22.00')
    })

    it('shows the menu-not-available message when open without a menu', async () => {
        const wrapper = await mountHome(async () => ({ ...base, status: 'open', service: win, remaining: 5, menu: null }))
        expect(wrapper.text()).toContain('Menu not available yet')
    })

    it('shows sold out with the next service time, without the "accepting orders" hero', async () => {
        const next = { ...win, id: 'n', start_at: '2026-10-24T19:00:00.000Z', end_at: '2026-10-25T02:00:00.000Z', notes: null }
        const wrapper = await mountHome(async () => ({ ...base, status: 'sold_out', service: win, remaining: 0, menu: null, next_service: next }))
        expect(wrapper.text()).toContain("We're sold out for tonight")
        expect(wrapper.text()).not.toContain('Accepting orders')
        expect(wrapper.get('[data-test="service-date"]').text()).toBe('Saturday, October 24')
        expect(wrapper.get('[data-test="service-times"]').text()).toBe('12:00 PM – 7:00 PM PDT')
    })

    it('keeps the menu visible but disables ordering when sold out', async () => {
        const wrapper = await mountHome(async () => ({ ...base, status: 'sold_out', service: win, remaining: 0, menu }))
        expect(wrapper.text()).toContain('Margherita')
        expect(wrapper.get('[data-test="order"]').attributes('disabled')).toBeDefined()
    })

    it('confirms an order with a toast that links to the cart', async () => {
        const wrapper = await mountHome(
            async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }),
            { create: async () => ({ data: { id: 'c1', cart_token: 't' } }), addItem: async () => ({ data: {} }), get: async () => ({ data: emptyCart }) },
        )

        await wrapper.get('[data-test="order"]').trigger('click')
        await flushPromises()

        expect(toast.success).toHaveBeenCalledWith('Margherita added to your cart', expect.objectContaining({ action: expect.objectContaining({ label: 'View cart' }) }))
        const action = vi.mocked(toast.success).mock.calls[0]![1]!.action as { onClick: () => void }
        action.onClick()
        expect(routerPush).toHaveBeenCalledWith('/cart')
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('shows an error toast, not a success toast, when the order exceeds the limit', async () => {
        const err = { response: { status: 409, data: { data: { code: 'over_limit', max_per_order: 4, remaining: 3 } } } }
        const wrapper = await mountHome(
            async () => ({ ...base, status: 'open', service: win, remaining: 5, menu }),
            { create: async () => ({ data: { id: 'c1', cart_token: 't' } }), addItem: async () => { throw err }, get: async () => ({ data: emptyCart }) },
        )

        await wrapper.get('[data-test="order"]').trigger('click')
        await flushPromises()

        expect(toast.error).toHaveBeenCalledWith('You can order up to 3 pizzas.')
        expect(toast.success).not.toHaveBeenCalled()
    })

    it('shows an error notice and retries', async () => {
        const getNext = vi.fn<(...args: never[]) => Promise<unknown>>()
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ ...base, status: 'none', service: null })
        const wrapper = await mountHome(getNext)
        expect(wrapper.text()).toContain('out of date')
        await wrapper.get('[data-test="retry"]').trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('No service scheduled')
        expect(wrapper.text()).not.toContain('out of date')
    })
})
