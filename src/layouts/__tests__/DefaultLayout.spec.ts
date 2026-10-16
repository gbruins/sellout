import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DefaultLayout from '../DefaultLayout.vue'

describe('DefaultLayout', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('decrements the sample pizza count after 44 seconds', async () => {
        vi.useFakeTimers()
        const wrapper = mount(DefaultLayout, {
            global: {
                stubs: ['RouterLink'],
            },
            slots: {
                default: '<div>Page content</div>',
            },
        })

        expect(wrapper.get('[role="status"]').text()).toBe('14 pizzas remaining')
        await vi.advanceTimersByTimeAsync(44_000)
        expect(wrapper.get('[role="status"]').text()).toBe('13 pizzas remaining')

        wrapper.unmount()
    })
})
