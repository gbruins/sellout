import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PizzaList from '../PizzaList.vue'

const menu = {
    id: 'm', title: 'Friday Menu', description: null,
    products: [
        { id: 'p1', title: 'Margherita', description: 'Tomato and basil', base_price: 2200 },
        { id: 'p2', title: 'Pepperoni', description: null, base_price: 2450 },
    ],
}

describe('PizzaList', () => {
    it('renders menu products with formatted prices and order buttons', () => {
        const wrapper = mount(PizzaList, { props: { menu } })

        expect(wrapper.findAll('li')).toHaveLength(2)
        // The internal menu title (e.g. "Friday Menu") is never shown to visitors — just "Menu"
        expect(wrapper.get('#pizza-list-title').text()).toBe('Menu')
        expect(wrapper.text()).toContain('Margherita')
        expect(wrapper.text()).toContain('Tomato and basil')
        expect(wrapper.findAll('[data-test="price"]').map((p) => p.text())).toEqual(['22.00', '24.50'])
        expect(wrapper.findAll('[data-test="order"]')).toHaveLength(2)
    })

    it('emits the selected product and quantity when Order Pie is clicked', async () => {
        const wrapper = mount(PizzaList, { props: { menu } })

        await wrapper.findAll('[data-test="order"]')[0]!.trigger('click')

        expect(wrapper.emitted('order')?.[0]?.[0]).toMatchObject({ id: 'p1', title: 'Margherita' })
        expect(wrapper.emitted('order')?.[0]?.[1]).toBe(1)
    })

    it('orders the quantity chosen in the stepper, then resets it back to 1', async () => {
        const wrapper = mount(PizzaList, { props: { menu } })

        const qtyInput = wrapper.findAll('[data-test="qty"]')[0]!
        await qtyInput.setValue('3')
        await qtyInput.trigger('change')
        await qtyInput.trigger('blur')

        await wrapper.findAll('[data-test="order"]')[0]!.trigger('click')

        expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'p1' }, 3])
        expect(wrapper.findAll('[data-test="qty"]')[0]!.element.getAttribute('value')).toBe('1')
    })

    it('shows a message when there is no menu or it is empty', () => {
        expect(mount(PizzaList, { props: { menu: null } }).get('[data-test="no-menu"]').text()).toContain('Menu not available yet')
        expect(mount(PizzaList, { props: { menu: { ...menu, products: [] } } }).find('[data-test="no-menu"]').exists()).toBe(true)
    })

    it('disables ordering and the quantity stepper when disabled', () => {
        const wrapper = mount(PizzaList, { props: { menu, disabled: true } })

        expect(wrapper.findAll('[data-test="order"]').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
        expect(wrapper.findAll('[data-test="qty"]').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    })

    it('tells visitors the per-order cap up front, and says nothing when it is unknown', () => {
        const wrapper = mount(PizzaList, { props: { menu, maxPerOrder: 4, remaining: 20 } })
        expect(wrapper.text()).toContain('Max 4 per order')

        expect(mount(PizzaList, { props: { menu } }).text()).not.toContain('per order')
    })

    it('caps the stepper at the per-order limit, not just the default ceiling', async () => {
        const wrapper = mount(PizzaList, { props: { menu, maxPerOrder: 2, remaining: 20 } })

        const qtyInput = wrapper.findAll('[data-test="qty"]')[0]!
        await qtyInput.setValue('5')
        await qtyInput.trigger('change')
        await qtyInput.trigger('blur')

        await wrapper.findAll('[data-test="order"]')[0]!.trigger('click')

        expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'p1' }, 2])
    })

    it('caps the stepper at what is actually left, when that is tighter than the per-order limit', async () => {
        const wrapper = mount(PizzaList, { props: { menu, maxPerOrder: 4, remaining: 1 } })

        await wrapper.findAll('[data-test="order"]')[0]!.trigger('click')

        expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'p1' }, 1])
    })

    it('names the pizza on each order button and quantity field for screen readers', () => {
        const wrapper = mount(PizzaList, { props: { menu } })

        expect(wrapper.findAll('[data-test="order"]').map((b) => b.attributes('aria-label'))).toEqual(['Order Margherita', 'Order Pepperoni'])
        expect(wrapper.findAll('[data-test="qty"]')[0]!.attributes('aria-label')).toBe('Quantity of Margherita')
    })

    it('shows progress only on the card being added', () => {
        const wrapper = mount(PizzaList, { props: { menu, disabled: true, addingId: 'p2' } })

        const buttons = wrapper.findAll('[data-test="order"]')
        expect(buttons[0]!.text()).toBe('Order')
        expect(buttons[1]!.text()).toBe('Adding…')

        // The card being added gets the animated border; the others don't
        const cards = wrapper.findAll('[data-slot="card"]')
        expect(cards[0]!.classes()).not.toContain('card-adding')
        expect(cards[1]!.classes()).toContain('card-adding')
    })

    it('shows the product photo when there is one', () => {
        const withImage = { ...menu, products: [{ ...menu.products[0]!, image: 'https://example.com/m.jpg' }] }
        const wrapper = mount(PizzaList, { props: { menu: withImage } })

        expect(wrapper.get('[data-test="product-image"]').attributes('src')).toBe('https://example.com/m.jpg')
    })
})
