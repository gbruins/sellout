import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PizzaRemainingCountdown from '../PizzaRemainingCountdown.vue'

describe('PizzaRemainingCountdown', () => {
    it('shows the default remaining count accessibly', () => {
        const wrapper = mount(PizzaRemainingCountdown)

        expect(wrapper.get('[role="status"]').text()).toBe('14 pizzas remaining')
        expect(wrapper.findAll('.flip-number-item')).toHaveLength(2)
        expect(wrapper.text()).toContain('Pizzas remaining')
    })

    it('updates the accessible count and number of digit tiles', async () => {
        const wrapper = mount(PizzaRemainingCountdown, { props: { remaining: 14 } })
        const originalTiles = wrapper.findAll('.flip-number-item').map((tile) => tile.element)

        await wrapper.setProps({ remaining: 13 })

        const updatedTiles = wrapper.findAll('.flip-number-item')
        expect(wrapper.get('[role="status"]').text()).toBe('13 pizzas remaining')
        expect(updatedTiles.map((tile) => tile.element)).toEqual(originalTiles)
        const lastUpdatedTile = updatedTiles[1]
        if (!lastUpdatedTile) throw new Error('Expected a second digit tile')
        expect(lastUpdatedTile.find('.flip').classes()).toContain('down')
        expect(lastUpdatedTile.find('.digital.back').classes()).toContain('number3')

        await wrapper.setProps({ remaining: 100 })
        expect(wrapper.findAll('.flip-number-item')).toHaveLength(3)
    })

    it('shows the real total in the cap label and never goes below zero', async () => {
        const wrapper = mount(PizzaRemainingCountdown, { props: { remaining: 0, total: 48 } })

        expect(wrapper.text()).toContain('Hard cap 48 pies')
        expect(wrapper.get('[role="status"]').text()).toBe('0 pizzas remaining')
        await wrapper.setProps({ remaining: -3 })
        expect(wrapper.get('[role="status"]').text()).toBe('0 pizzas remaining')
    })
})
