import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import DefaultLayout from '../DefaultLayout.vue'

describe('DefaultLayout', () => {
    it('renders only the slot content, with no home page content of its own', () => {
        const wrapper = mount(DefaultLayout, {
            global: { plugins: [createPinia()], stubs: ['RouterLink'], provide: { $api: { cart: { credentials: () => ({ id: null }) } } } },
            slots: { default: '<div>Page content</div>' },
        })

        expect(wrapper.text()).toContain('Page content')
        expect(wrapper.find('[role="status"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('Pizzas remaining')
    })
})
