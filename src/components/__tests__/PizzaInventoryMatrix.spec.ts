import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PizzaInventoryMatrix from '../PizzaInventoryMatrix.vue'

describe('PizzaInventoryMatrix', () => {
    it('shows allocated and remaining slots from its props', () => {
        const wrapper = mount(PizzaInventoryMatrix, {
            props: { total: 60, remaining: 14 },
        })

        expect(wrapper.findAll('.allocated-slot')).toHaveLength(46)
        expect(wrapper.findAll('.remaining-slot')).toHaveLength(14)
        expect(wrapper.get('[role="img"]').attributes('aria-label'))
            .toBe('46 allocated and 14 remaining out of 60 pizzas')
    })

    it('keeps the remaining count within the total', () => {
        const wrapper = mount(PizzaInventoryMatrix, {
            props: { total: 5, remaining: 9 },
        })

        expect(wrapper.findAll('.allocated-slot')).toHaveLength(0)
        expect(wrapper.findAll('.remaining-slot')).toHaveLength(5)
    })
})
