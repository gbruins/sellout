import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import ServiceClosedCard from '../ServiceClosedCard.vue'

const mountCard = (subscribe: (email: string) => Promise<unknown>, props: Record<string, unknown> = {}) =>
    mount(ServiceClosedCard, {
        props: { service: null, ...props },
        global: { plugins: [createPinia()], provide: { $api: { subscribe: { subscribe } } } },
    })

describe('ServiceClosedCard subscribe form', () => {
    it('subscribes a valid email and shows a confirmation', async () => {
        const subscribe = vi.fn().mockResolvedValue({ subscribed: true })
        const wrapper = mountCard(subscribe)

        await wrapper.get('[data-test="subscribe-email"]').setValue('visitor@example.com')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(subscribe).toHaveBeenCalledWith('visitor@example.com')
        expect(wrapper.find('[data-test="subscribe-success"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="subscribe-email"]').exists()).toBe(false)
    })

    it('shows a validation error for a malformed email and never calls the API', async () => {
        const subscribe = vi.fn()
        const wrapper = mountCard(subscribe)

        await wrapper.get('[data-test="subscribe-email"]').setValue('not-an-email')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(subscribe).not.toHaveBeenCalled()
        expect(wrapper.get('[data-test="subscribe-validation-error"]').text()).toContain('valid email')
        expect(wrapper.find('[data-test="subscribe-success"]').exists()).toBe(false)
    })

    it('shows an error message if the API call fails, and the form stays visible', async () => {
        const subscribe = vi.fn().mockRejectedValue(new Error('network error'))
        const wrapper = mountCard(subscribe)

        await wrapper.get('[data-test="subscribe-email"]').setValue('visitor@example.com')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(wrapper.get('[data-test="subscribe-api-error"]').text()).toMatch(/wrong/i)
        expect(wrapper.find('[data-test="subscribe-email"]').exists()).toBe(true)
    })
})
