import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FlipNumber from '../flipNumber/FlipNumber.vue'

describe('FlipNumber Vue 3 conversion', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('splits digits and preserves non-digit characters', () => {
        const wrapper = mount(FlipNumber, { props: { value: '0012.50' } })

        expect(wrapper.findAll('.flip-number-item')).toHaveLength(6)
        expect(wrapper.find('.sign').text()).toBe('.')
        expect(wrapper.findAll('.digital.back').map((digit) => digit.classes())).toEqual([
            ['digital', 'back', 'number0'],
            ['digital', 'back', 'number0'],
            ['digital', 'back', 'number1'],
            ['digital', 'back', 'number2'],
            ['digital', 'back', 'number5'],
            ['digital', 'back', 'number0'],
        ])
    })

    it('flips changed digits downward', async () => {
        vi.useFakeTimers()
        const wrapper = mount(FlipNumber, { props: { value: '19' } })

        await wrapper.setProps({ value: '20' })

        const items = wrapper.findAll('.flip-number-item')
        const [tens, ones] = items
        if (!tens || !ones) throw new Error('Expected two flip-number items')
        expect(tens.find('.flip').classes()).toContain('down')
        expect(tens.find('.flip').classes()).toContain('go')
        expect(ones.find('.flip').classes()).toContain('down')
        expect(ones.find('.flip').classes()).toContain('go')

        await vi.advanceTimersByTimeAsync(600)

        expect(tens.find('.digital.front').classes()).toContain('number2')
        expect(ones.find('.digital.front').classes()).toContain('number0')

        await vi.runAllTimersAsync()

        expect(ones.find('.digital.front').classes()).toContain('number0')
        wrapper.unmount()
    })

    it('rolls downward when a digit decreases', async () => {
        vi.useFakeTimers()
        const wrapper = mount(FlipNumber, { props: { value: '14' } })

        await wrapper.setProps({ value: '13' })

        const ones = wrapper.findAll('.flip-number-item')[1]
        if (!ones) throw new Error('Expected a ones digit')
        expect(ones.find('.flip').classes()).toContain('down')

        await vi.runAllTimersAsync()

        expect(ones.find('.digital.front').classes()).toContain('number3')
        wrapper.unmount()
    })

    it('keeps the displayed digit in sync when values update during a flip', async () => {
        vi.useFakeTimers()
        const wrapper = mount(FlipNumber, { props: { value: '14' } })

        await wrapper.setProps({ value: '13' })
        await wrapper.setProps({ value: '12' })

        const ones = wrapper.findAll('.flip-number-item')[1]
        if (!ones) throw new Error('Expected a ones digit')
        expect(ones.find('.digital.back').classes()).toContain('number2')

        await vi.advanceTimersByTimeAsync(600)

        expect(ones.find('.digital.front').classes()).toContain('number2')
        wrapper.unmount()
    })
})
