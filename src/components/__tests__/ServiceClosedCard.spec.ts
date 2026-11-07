import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import ServiceClosedCard from '../ServiceClosedCard.vue'
import { stubApi } from '@/test/stubApi'

const mountCard = (subscribe: (email: string) => Promise<unknown>, props: Record<string, unknown> = {}) => {
    stubApi({ subscribe: { subscribe } })
    return mount(ServiceClosedCard, {
        props: { service: null, ...props },
        global: { plugins: [createPinia()] },
    })
}

describe('ServiceClosedCard subscribe form', () => {
    it('subscribes a valid email and shows a confirmation', async () => {
        const subscribe = vi.fn<(value: string) => Promise<unknown>>().mockResolvedValue({ subscribed: true })
        const wrapper = mountCard(subscribe)

        await wrapper.get('[data-test="subscribe-email"]').setValue('visitor@example.com')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(subscribe).toHaveBeenCalledWith('visitor@example.com')
        expect(wrapper.find('[data-test="subscribe-success"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="subscribe-email"]').exists()).toBe(false)
    })

    it('shows a validation error for a malformed email and never calls the API', async () => {
        const subscribe = vi.fn<(value: string) => Promise<unknown>>()
        const wrapper = mountCard(subscribe)

        await wrapper.get('[data-test="subscribe-email"]').setValue('not-an-email')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(subscribe).not.toHaveBeenCalled()
        expect(wrapper.get('[data-test="subscribe-validation-error"]').text()).toContain('valid email')
        expect(wrapper.find('[data-test="subscribe-success"]').exists()).toBe(false)
    })

    it('shows an error message if the API call fails, and the form stays visible', async () => {
        const subscribe = vi.fn<(value: string) => Promise<unknown>>().mockRejectedValue(new Error('network error'))
        const wrapper = mountCard(subscribe)

        await wrapper.get('[data-test="subscribe-email"]').setValue('visitor@example.com')
        await wrapper.get('form').trigger('submit')
        await flushPromises()

        expect(wrapper.get('[data-test="subscribe-api-error"]').text()).toMatch(/wrong/i)
        expect(wrapper.find('[data-test="subscribe-email"]').exists()).toBe(true)
    })
})

describe('ServiceClosedCard copy', () => {
    it('labels the email field for assistive tech and autofill', () => {
        const wrapper = mountCard(vi.fn<(value: string) => Promise<unknown>>())
        expect(wrapper.get('label[for="subscribe-email"]').text()).toBe('Email address')
        expect(wrapper.get('[data-test="subscribe-email"]').attributes('autocomplete')).toBe('email')
    })

    it('says sold out rather than closed when the service sold out', () => {
        expect(mountCard(vi.fn<(value: string) => Promise<unknown>>(), { soldOut: true }).text()).toContain("We're sold out for tonight")
        expect(mountCard(vi.fn<(value: string) => Promise<unknown>>()).text()).toContain("We're closed right now")
    })
})
