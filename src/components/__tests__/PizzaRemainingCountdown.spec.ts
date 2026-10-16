import { describe, expect, it, vi } from 'vitest'
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

    it('counts down every second in development and stays at zero', async () => {
        vi.useFakeTimers()
        const wrapper = mount(PizzaRemainingCountdown, { props: { remaining: 14 } })

        try {
            await vi.advanceTimersByTimeAsync(1000)
            expect(wrapper.get('[role="status"]').text()).toBe('13 pizzas remaining')

            await vi.advanceTimersByTimeAsync(1000)
            expect(wrapper.get('[role="status"]').text()).toBe('12 pizzas remaining')

            await wrapper.setProps({ remaining: 1 })
            await vi.advanceTimersByTimeAsync(2000)
            expect(wrapper.get('[role="status"]').text()).toBe('0 pizzas remaining')
        } finally {
            wrapper.unmount()
            vi.useRealTimers()
        }
    })
})
