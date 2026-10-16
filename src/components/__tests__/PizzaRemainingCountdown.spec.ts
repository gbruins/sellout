import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PizzaRemainingCountdown from '../PizzaRemainingCountdown.vue'

describe('PizzaRemainingCountdown', () => {
    it('shows the default remaining count accessibly', () => {
        const wrapper = mount(PizzaRemainingCountdown)

        expect(wrapper.get('[role="status"]').text()).toBe('14 pizzas remaining')
        expect(wrapper.findAll('.flap-digit')).toHaveLength(2)
        expect(wrapper.text()).toContain('Pizzas remaining')
    })

    it('updates the accessible count and number of digit tiles', async () => {
        const wrapper = mount(PizzaRemainingCountdown, { props: { remaining: 14 } })
        const originalTiles = wrapper.findAll('.flap-digit').map((tile) => tile.element)

        await wrapper.setProps({ remaining: 13 })

        const updatedTiles = wrapper.findAll('.flap-digit')
        expect(wrapper.get('[role="status"]').text()).toBe('13 pizzas remaining')
        expect(updatedTiles.map((tile) => tile.element)).toEqual(originalTiles)
        expect(updatedTiles.map((tile) => tile.text())).toEqual(['1', '3'])

        await wrapper.setProps({ remaining: 100 })
        expect(wrapper.findAll('.flap-digit')).toHaveLength(3)
    })
})
