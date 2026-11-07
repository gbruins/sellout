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
        expect(wrapper.text()).toContain('Max 4 pizzas per order')
        expect(mount(PizzaList, { props: { menu, maxPerOrder: 1 } }).text()).toContain('Max 1 pizza per order')

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

    describe('only pizzas (limited products) are capped', () => {
        const mixed = {
            ...menu,
            products: [
                { id: 'p1', title: 'Margherita', description: null, base_price: 2200, limited: true },
                { id: 'd1', title: 'Soda', description: null, base_price: 300, limited: false },
            ],
        }

        async function orderQty(wrapper: ReturnType<typeof mount>, index: number, qty: string) {
            const qtyInput = wrapper.findAll('[data-test="qty"]')[index]!
            await qtyInput.setValue(qty)
            await qtyInput.trigger('change')
            await qtyInput.trigger('blur')
            await wrapper.findAll('[data-test="order"]')[index]!.trigger('click')
        }

        it('lets a non-pizza product go past max_per_order and what is left', async () => {
            const wrapper = mount(PizzaList, { props: { menu: mixed, maxPerOrder: 2, remaining: 1 } })

            await orderQty(wrapper, 1, '6')

            expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'd1' }, 6])
        })

        it('still caps a pizza on the same menu', async () => {
            const wrapper = mount(PizzaList, { props: { menu: mixed, maxPerOrder: 2, remaining: 20 } })

            await orderQty(wrapper, 0, '6')

            expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'p1' }, 2])
        })

        it('caps a product without the flag, as an older server would send', async () => {
            const wrapper = mount(PizzaList, { props: { menu, maxPerOrder: 2, remaining: 20 } })

            await orderQty(wrapper, 1, '6')

            expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'p2' }, 2])
        })

        it('hides the per-order note when no product on the menu is limited', () => {
            const drinksOnly = { ...menu, products: [mixed.products[1]!] }

            expect(mount(PizzaList, { props: { menu: drinksOnly, maxPerOrder: 2 } }).text()).not.toContain('per order')
        })
    })

    it('shows an out-of-stock product but does not let it be ordered', async () => {
        const withSoldOut = { ...menu, products: [{ ...menu.products[0]!, available: false }, menu.products[1]!] }
        const wrapper = mount(PizzaList, { props: { menu: withSoldOut } })

        expect(wrapper.findAll('li')).toHaveLength(2)
        expect(wrapper.findAll('[data-test="out-of-stock"]')).toHaveLength(1)

        const [soldOut, inStock] = wrapper.findAll('[data-test="order"]')
        expect(soldOut!.attributes('disabled')).toBeDefined()
        expect(soldOut!.attributes('aria-label')).toBe('Margherita is out of stock')
        expect(wrapper.findAll('[data-test="qty"]')[0]!.attributes('disabled')).toBeDefined()

        // The other card is unaffected
        expect(inStock!.attributes('disabled')).toBeUndefined()
        await inStock!.trigger('click')
        expect(wrapper.emitted('order')?.[0]).toMatchObject([{ id: 'p2' }, 1])
    })

    describe('sections by product type', () => {
        const mixed = {
            ...menu,
            products: [
                { id: 'p1', title: 'Margherita', description: null, base_price: 2200, product_type: 1, type_name: 'Pizza', limited: true },
                { id: 'd1', title: 'Soda', description: null, base_price: 300, product_type: 2, type_name: 'Drinks', limited: false, available: false },
                { id: 'p2', title: 'Pepperoni', description: null, base_price: 2450, product_type: 1, type_name: 'Pizza', limited: true },
            ],
        }

        it('shows one titled section per type, in menu order', () => {
            const wrapper = mount(PizzaList, { props: { menu: mixed } })

            const sections = wrapper.findAll('[data-test="menu-section"]')
            expect(wrapper.findAll('[data-test="section-title"]').map((h) => h.text())).toEqual(['Pizza', 'Drinks'])
            expect(sections[0]!.findAll('h4').map((h) => h.text())).toEqual(['Margherita', 'Pepperoni'])
            // An out-of-stock product still shows in its section
            expect(sections[1]!.find('[data-test="out-of-stock"]').exists()).toBe(true)
        })

        it('puts the per-order note on the Pizza heading, not the page header', () => {
            const wrapper = mount(PizzaList, { props: { menu: mixed, maxPerOrder: 4 } })

            const notes = wrapper.findAll('[data-test="max-per-order"]')
            expect(notes).toHaveLength(1)
            expect(wrapper.findAll('[data-test="menu-section"]')[0]!.text()).toContain('Max 4 pizzas per order')
        })

        it('shows no section headings when the menu has a single type', () => {
            const pizzasOnly = { ...mixed, products: [mixed.products[0]!, mixed.products[2]!] }
            const wrapper = mount(PizzaList, { props: { menu: pizzasOnly, maxPerOrder: 4 } })

            expect(wrapper.find('[data-test="section-title"]').exists()).toBe(false)
            expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['Margherita', 'Pepperoni'])
            expect(wrapper.get('#pizza-list-title').text()).toBe('Menu')
            expect(wrapper.text()).toContain('Max 4 pizzas per order')
        })
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
