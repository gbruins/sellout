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
        expect(wrapper.text()).toContain('Friday Menu')
        expect(wrapper.text()).toContain('Margherita')
        expect(wrapper.text()).toContain('Tomato and basil')
        expect(wrapper.findAll('[data-test="price"]').map((p) => p.text())).toEqual(['$22.00', '$24.50'])
        expect(wrapper.findAll('button')).toHaveLength(2)
    })

    it('emits the selected product when its order button is clicked', async () => {
        const wrapper = mount(PizzaList, { props: { menu } })

        await wrapper.find('button').trigger('click')

        expect(wrapper.emitted('order')?.[0]?.[0]).toMatchObject({ id: 'p1', title: 'Margherita' })
    })

    it('shows a message when there is no menu or it is empty', () => {
        expect(mount(PizzaList, { props: { menu: null } }).get('[data-test="no-menu"]').text()).toContain('Menu not available yet')
        expect(mount(PizzaList, { props: { menu: { ...menu, products: [] } } }).find('[data-test="no-menu"]').exists()).toBe(true)
    })

    it('disables ordering when disabled', () => {
        const wrapper = mount(PizzaList, { props: { menu, disabled: true } })

        expect(wrapper.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    })
})
