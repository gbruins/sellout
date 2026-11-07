import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import CartIndicator from '../CartIndicator.vue'
import { useServiceStore } from '@/stores/service'
import { useCartStore } from '@/stores/cart'

const mountIndicator = () => {
    const pinia = createPinia()
    const wrapper = mount(CartIndicator, {
        global: {
            plugins: [pinia],
            stubs: { RouterLink: true },
        },
    })
    return { wrapper, pinia }
}

describe('CartIndicator', () => {
    it('shows while the service status is still unknown (before the first load)', () => {
        const { wrapper } = mountIndicator()
        expect(wrapper.find('[data-test="cart-indicator"]').exists()).toBe(true)
    })

    it('shows while open, even with an empty cart', () => {
        const { wrapper, pinia } = mountIndicator()
        useServiceStore(pinia).status = 'open'
        expect(wrapper.find('[data-test="cart-indicator"]').exists()).toBe(true)
    })

    it('hides once closed with nothing in the cart', async () => {
        const { wrapper, pinia } = mountIndicator()
        useServiceStore(pinia).status = 'none'
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[data-test="cart-indicator"]').exists()).toBe(false)
    })

    it('stays visible when closed but the cart still has items', async () => {
        const { wrapper, pinia } = mountIndicator()
        useServiceStore(pinia).status = 'sold_out'
        useCartStore(pinia).cart = {
            id: 'c1', num_items: 2, price_subtotal: 2000, grand_total: 2000,
            customer_note: null, checkout_in_progress: false, cart_items: [],
        }
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[data-test="cart-indicator"]').exists()).toBe(true)
    })
})

describe('CartIndicator label', () => {
    it('announces the count with a pluralized label', async () => {
        const { wrapper, pinia } = mountIndicator()
        expect(wrapper.get('[data-test="cart-indicator"]').attributes('aria-label')).toBe('Cart, no pizzas')
        useCartStore(pinia).cart = {
            id: 'c1', num_items: 1, price_subtotal: 2000, grand_total: 2000,
            customer_note: null, checkout_in_progress: false, cart_items: [],
        }
        await wrapper.vm.$nextTick()
        expect(wrapper.get('[data-test="cart-indicator"]').attributes('aria-label')).toBe('Cart, 1 pizza')
    })
})
