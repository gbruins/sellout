import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import apiPlugin, { axiosInstance } from '@/plugins/api';
import { getCartCredentials, saveCartCredentials } from '@/utils/cartCredentials';

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
});
