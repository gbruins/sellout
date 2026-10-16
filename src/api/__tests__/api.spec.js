import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import apiPlugin, { axiosInstance } from '@/plugins/api';
import { createPinia, setActivePinia } from 'pinia';
import { getCartCredentials, saveCartCredentials } from '@/utils/cartCredentials';
import { useCartNoticeStore } from '@/stores/cartNotice';
import { cartErrorMessage } from '@/utils/cartErrors';

function installApi() {
    const app = createApp({});
    app.use(apiPlugin);
    return app._context.provides.$api;
}

describe('api auth wiring', () => {
    beforeEach(() => {
        const store = new Map();
        vi.stubGlobal('localStorage', {
            getItem: (k) => store.get(k) ?? null,
            setItem: (k, v) => store.set(k, v),
            removeItem: (k) => store.delete(k),
        });
        vi.stubEnv('VITE_API_USER', 'store');
        vi.stubEnv('VITE_API_KEY', 'abc123');
    });

    it('sends Basic auth and no cart token before a cart exists', async () => {
        installApi();
        const config = await axiosInstance.interceptors.request.handlers[0].fulfilled({ headers: {} });

        expect(axiosInstance.defaults.headers.Authorization).toBe(`Basic ${btoa('store:abc123')}`);
        expect(config.headers['X-Cart-Token']).toBeUndefined();
    });

    it('stores credentials on cart create and sends the token afterwards', async () => {
        const $api = installApi();
        axiosInstance.defaults.adapter = async (config) => ({
            data: { data: { id: 'cart-1', cart_token: 'tok-1' } },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        });

        await $api.cart.create();
        expect(getCartCredentials()).toEqual({ id: 'cart-1', token: 'tok-1' });

        const config = await axiosInstance.interceptors.request.handlers[0].fulfilled({ headers: {} });
        expect(config.headers['X-Cart-Token']).toBe('tok-1');
    });

    it('posts the stored cart id to checkout and returns the Stripe url', async () => {
        const $api = installApi();
        saveCartCredentials('cart-1', 'tok-1');
        let request;
        axiosInstance.defaults.adapter = async (config) => {
            request = config;
            return { data: { data: { url: 'https://checkout.stripe.com/x' } }, status: 200, statusText: 'OK', headers: {}, config };
        };

        const response = await $api.cart.checkout();

        expect(request.url).toBe('cart/checkout');
        expect(JSON.parse(request.data)).toEqual({ id: 'cart-1' });
        expect(response.data.url).toBe('https://checkout.stripe.com/x');
    });

    it('shows the one-time notice when the server reports the cart was reset', async () => {
        setActivePinia(createPinia());
        const $api = installApi();
        saveCartCredentials('cart-1', 'tok-1');
        axiosInstance.defaults.adapter = async (config) => ({
            data: { data: { id: 'cart-1', cart_items: [], cart_reset: 'service_ended' } },
            status: 200, statusText: 'OK', headers: {}, config,
        });

        await $api.cart.get();

        expect(useCartNoticeStore().message).toContain('cart was emptied');
        expect(getCartCredentials().id).toBe('cart-1');
    });

    it('forgets the stored cart when the server says it is gone', async () => {
        const $api = installApi();
        saveCartCredentials('cart-1', 'tok-1');
        axiosInstance.defaults.adapter = async (config) => {
            const error = new Error('Not Found');
            error.response = { status: 404, data: {}, config };
            error.config = config;
            throw error;
        };

        await expect($api.cart.get()).rejects.toThrow();

        expect(getCartCredentials()).toEqual({ id: null, token: null });
    });
});

describe('cartErrorMessage', () => {
    const conflict = (data) => ({ response: { status: 409, data: { data } } });

    it('explains service hours and sold out', () => {
        expect(cartErrorMessage(conflict({ code: 'no_open_service' }))).toBe('The shop is not open right now.');
        expect(cartErrorMessage(conflict({ code: 'service_closed' }))).toBe('The shop is not open right now.');
        expect(cartErrorMessage(conflict({ code: 'sold_out' }))).toBe('Sorry, we are sold out.');
    });

    it('uses the lower of the order cap and the pizzas remaining', () => {
        expect(cartErrorMessage(conflict({ code: 'over_limit', max_per_order: 4, remaining: 9 }))).toBe('You can order up to 4 pizzas.');
        expect(cartErrorMessage(conflict({ code: 'over_limit', max_per_order: 4, remaining: 1 }))).toBe('You can order up to 1 pizza.');
    });

    it('falls back to the server message or a generic one', () => {
        expect(cartErrorMessage({ response: { status: 400, data: { message: 'Cart is empty' } } })).toBe('Cart is empty');
        expect(cartErrorMessage(new Error('x'))).toBe('Something went wrong. Please try again.');
    });
});
