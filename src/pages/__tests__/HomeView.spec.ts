import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import HomeView from '../HomeView.vue'

vi.mock('@/utils/serviceStream', () => ({ openServiceStream: vi.fn(() => vi.fn()) }))

const mountHome = (getNext: () => Promise<unknown>) =>
    mount(HomeView, {
        global: { plugins: [createPinia()], provide: { $api: { service: { getNext } } } },
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
        expect(wrapper.text()).toContain('$22.00')
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
