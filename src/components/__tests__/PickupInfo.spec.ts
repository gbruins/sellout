import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import PickupInfo from '../PickupInfo.vue'
import { useServiceStore } from '@/stores/service'

const shop = {
    name: 'Sellout', address_line1: '1 Oven Way', address_line2: null,
    address_city: 'Portland', address_state: 'OR', address_postal_code: '97201', phone: null,
}

beforeEach(() => {
    setActivePinia(createPinia())
    useServiceStore().shop = shop
})

const directions = (wrapper: ReturnType<typeof mount>) =>
    decodeURIComponent(wrapper.get('a[target="_blank"]').attributes('href')!)

describe('PickupInfo', () => {
    it('shows the full address by default', () => {
        const wrapper = mount(PickupInfo)
        expect(wrapper.get('address').text()).toContain('Portland, OR 97201')
    })

    it('drops the state and zip when compact, but still gives directions to the full address', () => {
        const wrapper = mount(PickupInfo, { props: { compact: true } })
        // One line, street then city
        expect(wrapper.get('address').text()).toBe('1 Oven Way, Portland')
        expect(directions(wrapper)).toContain('1 Oven Way, Portland, OR 97201')
    })

    it('renders nothing until the shop has an address', () => {
        useServiceStore().shop = { ...shop, address_line1: null }
        expect(mount(PickupInfo).find('[data-test="pickup-info"]').exists()).toBe(false)
    })
})
