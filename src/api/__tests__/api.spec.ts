import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { api } from '@/api'
import { http } from '@/api/client'
import { getCartCredentials, saveCartCredentials } from '@/api/cartCredentials'
import { useCartNoticeStore } from '@/stores/cartNotice'
import { cartErrorMessage } from '@/utils/cartErrors'

const ok = (data: unknown): AxiosAdapter => async (config) => ({ data: { data }, status: 200, statusText: 'OK', headers: {}, config })

// Runs a request config through the client's request interceptor, as axios would
const intercept = async () => {
    const handler = (http.interceptors.request as unknown as { handlers: { fulfilled: (c: unknown) => Promise<InternalAxiosRequestConfig> }[] }).handlers[0]!
    return handler.fulfilled({ headers: {} })
}

describe('api client', () => {
    beforeEach(() => {
        const store = new Map<string, string>()
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => store.set(k, v),
            removeItem: (k: string) => store.delete(k),
        })
        setActivePinia(createPinia())
    })

    it('sends no cart token before a cart exists', async () => {
        expect((await intercept()).headers['X-Cart-Token']).toBeUndefined()
    })

    it('stores credentials on cart create and sends the token afterwards', async () => {
        http.defaults.adapter = ok({ id: 'cart-1', cart_token: 'tok-1' })

        await api.cart.create()

        expect(getCartCredentials()).toEqual({ id: 'cart-1', token: 'tok-1' })
        expect((await intercept()).headers['X-Cart-Token']).toBe('tok-1')
    })

    it('posts the stored cart id to checkout and returns a Stripe client_secret', async () => {
        saveCartCredentials('cart-1', 'tok-1')
        let request: InternalAxiosRequestConfig | undefined
        http.defaults.adapter = async (config) => {
            request = config
            return ok({ client_secret: 'cs_test_x_secret_y' })(config)
        }

        const response = await api.cart.checkout()

        expect(request?.url).toBe('cart/checkout')
        expect(JSON.parse(request?.data)).toEqual({ id: 'cart-1' })
        expect(response.data.client_secret).toBe('cs_test_x_secret_y')
    })

    it('looks up an order confirmation by Checkout Session id', async () => {
        let request: InternalAxiosRequestConfig | undefined
        http.defaults.adapter = async (config) => {
            request = config
            return ok({ status: 'pending' })(config)
        }

        expect(await api.orders.confirmation('cs_test_1')).toEqual({ status: 'pending' })
        expect(request?.url).toBe('orders/confirmation')
        expect(request?.params).toEqual({ session_id: 'cs_test_1' })
    })

    it('shows the one-time notice when the server reports the cart was reset', async () => {
        saveCartCredentials('cart-1', 'tok-1')
        http.defaults.adapter = ok({ id: 'cart-1', cart_items: [], cart_reset: 'service_ended' })

        await api.cart.get()

        expect(useCartNoticeStore().visible).toBe(true)
        expect(getCartCredentials().id).toBe('cart-1')
    })

    it('forgets the stored cart when the server says it is gone', async () => {
        saveCartCredentials('cart-1', 'tok-1')
        http.defaults.adapter = async (config) => {
            throw Object.assign(new Error('Not Found'), { response: { status: 404, data: {}, config }, config })
        }

        await expect(api.cart.get()).rejects.toThrow('Not Found')

        expect(getCartCredentials()).toEqual({ id: null, token: null })
    })
})

describe('cartErrorMessage', () => {
    const conflict = (data: Record<string, unknown>) => ({ response: { status: 409, data: { data } } })

    it('maps service hours and sold out to their messages', () => {
        expect(cartErrorMessage(conflict({ code: 'no_open_service' }))).toEqual({ key: 'errors.notOpen' })
        expect(cartErrorMessage(conflict({ code: 'service_closed' }))).toEqual({ key: 'errors.notOpen' })
        expect(cartErrorMessage(conflict({ code: 'sold_out' }))).toEqual({ key: 'errors.soldOut' })
    })

    it('uses the lower of the order cap and the pizzas remaining', () => {
        expect(cartErrorMessage(conflict({ code: 'over_limit', max_per_order: 4, remaining: 9 }))).toEqual({ key: 'errors.overLimit', params: { n: 4 }, plural: 4 })
        expect(cartErrorMessage(conflict({ code: 'over_limit', max_per_order: 4, remaining: 1 }))).toEqual({ key: 'errors.overLimit', params: { n: 1 }, plural: 1 })
    })

    it('names the unavailable item when the server does', () => {
        expect(cartErrorMessage(conflict({ code: 'item_unavailable', title: 'Margherita' }))).toEqual({ key: 'errors.itemUnavailable', params: { title: 'Margherita' } })
        expect(cartErrorMessage(conflict({ code: 'item_unavailable' }))).toEqual({ key: 'errors.anItemUnavailable' })
    })

    it('falls back to a generic message', () => {
        expect(cartErrorMessage({ response: { status: 400, data: { message: 'Cart is empty' } } })).toEqual({ key: 'errors.generic' })
        expect(cartErrorMessage(new Error('x'))).toEqual({ key: 'errors.generic' })
    })
})
