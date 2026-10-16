import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PizzaList from '../PizzaList.vue'

describe('PizzaList', () => {
    it('renders pizza names, descriptions, and order buttons without leading numbers', () => {
        const wrapper = mount(PizzaList)

        expect(wrapper.findAll('li')).toHaveLength(4)
        expect(wrapper.text()).toContain('The Margherita')
        expect(wrapper.text()).toContain('Crushed San Marzano tomatoes')
        expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
            'Order now',
            'Order now',
            'Order now',
            'Order now',
        ])
        expect(wrapper.find('h3').text()).not.toMatch(/^\d/)
    })

    it('emits the selected pizza when its order button is clicked', async () => {
        const wrapper = mount(PizzaList)

        await wrapper.find('button').trigger('click')

        expect(wrapper.emitted('order')?.[0]?.[0]).toMatchObject({
            id: 'margherita',
            name: 'The Margherita',
        })
    })
})
